import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';
import { Guest } from './entities/guest.entity';
import { Reservation } from './entities/reservation.entity';
import { BookingGroup } from './entities/booking-group.entity';
import {
  BulkCreateRoomsDto,
  CreateRoomDto,
  UpdateRoomDtoExtended,
} from './dto/create-room.dto';
import { EventsService } from '../events/events.service';
import { FoliosService } from '../folios/folios.service';
import { CleaningService } from '../cleaning/cleaning.service';
import { OutboundMessageService } from '../notifications/outbound-message.service';

// Reservation statuses that physically occupy the room and therefore conflict
// with new bookings overlapping the same dates.
const ACTIVE_RESERVATION_STATUSES = ['pending', 'confirmed', 'checked-in'];

@Injectable()
export class HotelService {
  constructor(
    @InjectRepository(Room) private roomsRepo: Repository<Room>,
    @InjectRepository(RoomType) private roomTypesRepo: Repository<RoomType>,
    @InjectRepository(Guest) private guestsRepo: Repository<Guest>,
    @InjectRepository(Reservation)
    private reservationsRepo: Repository<Reservation>,
    @InjectRepository(BookingGroup)
    private bookingGroupsRepo: Repository<BookingGroup>,
    private eventsService: EventsService,
    private foliosService: FoliosService,
    private cleaningService: CleaningService,
    private outbound: OutboundMessageService,
  ) {}

  // ─── Rooms ────────────────────────────────────────────────────
  async findAllRooms(): Promise<Room[]> {
    return this.roomsRepo.find({
      order: { number: 'ASC' },
      relations: ['roomType'],
    });
  }

  async findRoomByNumber(number: number): Promise<Room> {
    const room = await this.roomsRepo.findOne({
      where: { number },
      relations: ['roomType'],
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  /**
   * Create a single room. If `roomTypeId` is set, missing spec fields
   * (beds, maxGuests, pricePerNight, type-string) are inherited from the
   * RoomType so the legacy v1 grid keeps rendering correctly.
   */
  async createRoom(data: CreateRoomDto): Promise<Room> {
    const existing = await this.roomsRepo.findOne({
      where: { number: data.number },
    });
    if (existing) {
      throw new ConflictException(`Room ${data.number} already exists`);
    }

    let typeRow: RoomType | null = null;
    if (data.roomTypeId) {
      typeRow = await this.roomTypesRepo.findOne({
        where: { id: data.roomTypeId },
      });
      if (!typeRow) {
        throw new BadRequestException('roomTypeId does not exist');
      }
    }

    const beds = data.beds ?? typeRow?.beds ?? 1;
    const maxGuests = data.maxGuests ?? typeRow?.maxGuests ?? 2;
    const pricePerNight =
      data.pricePerNight ?? Number(typeRow?.basePrice) ?? 0;
    const typeLabel = data.type ?? typeRow?.code ?? 'standard';

    const room = this.roomsRepo.create({
      number: data.number,
      type: typeLabel,
      roomTypeId: data.roomTypeId,
      beds,
      maxGuests,
      pricePerNight,
      floor: data.floor,
      location: data.location,
      notes: data.notes,
      status: 'available',
      cleaningStatus: 'clean',
      isActive: true,
    });
    return this.roomsRepo.save(room);
  }

  /**
   * Create N rooms of the same type in one shot. Either pass `numbers`
   * (explicit list) or `from` + `count` (range, sequential). Skips
   * existing numbers without erroring out — partial application is
   * acceptable for bulk admin actions.
   */
  async bulkCreateRooms(data: BulkCreateRoomsDto): Promise<{
    created: Room[];
    skipped: number[];
  }> {
    const typeRow = await this.roomTypesRepo.findOne({
      where: { id: data.roomTypeId },
    });
    if (!typeRow) {
      throw new BadRequestException('roomTypeId does not exist');
    }

    let numbers: number[];
    if (data.numbers && data.numbers.length > 0) {
      numbers = data.numbers;
    } else if (
      typeof data.from === 'number' &&
      typeof data.count === 'number'
    ) {
      numbers = Array.from(
        { length: data.count },
        (_, i) => data.from! + i,
      );
    } else {
      throw new BadRequestException(
        'Either `numbers` or both `from` and `count` are required',
      );
    }

    const existing = await this.roomsRepo
      .createQueryBuilder('r')
      .where('r.number IN (:...nums)', { nums: numbers })
      .getMany();
    const existingSet = new Set(existing.map((r) => r.number));

    const toCreate = numbers
      .filter((n) => !existingSet.has(n))
      .map((n) =>
        this.roomsRepo.create({
          number: n,
          type: typeRow.code,
          roomTypeId: typeRow.id,
          beds: typeRow.beds,
          maxGuests: typeRow.maxGuests,
          pricePerNight: typeRow.basePrice,
          floor: data.floor,
          status: 'available',
          cleaningStatus: 'clean',
          isActive: true,
        }),
      );

    const created = await this.roomsRepo.save(toCreate);
    return {
      created,
      skipped: numbers.filter((n) => existingSet.has(n)),
    };
  }

  async updateRoom(
    number: number,
    data: Partial<Room> | UpdateRoomDtoExtended,
  ): Promise<Room> {
    const room = await this.roomsRepo.findOne({ where: { number } });
    if (!room) throw new NotFoundException('Room not found');

    // If switching room type, validate the FK and refresh denormalized
    // fields that didn't get explicit DTO values. Keeps spec consistent.
    const incoming = data as Partial<Room> & { roomTypeId?: string };
    if (incoming.roomTypeId && incoming.roomTypeId !== room.roomTypeId) {
      const typeRow = await this.roomTypesRepo.findOne({
        where: { id: incoming.roomTypeId },
      });
      if (!typeRow) {
        throw new BadRequestException('roomTypeId does not exist');
      }
      if (incoming.type === undefined) incoming.type = typeRow.code;
      if (incoming.beds === undefined) incoming.beds = typeRow.beds;
      if (incoming.maxGuests === undefined) {
        incoming.maxGuests = typeRow.maxGuests;
      }
      if (incoming.pricePerNight === undefined) {
        incoming.pricePerNight = typeRow.basePrice;
      }
    }

    Object.assign(room, incoming);
    const saved = await this.roomsRepo.save(room);
    this.eventsService.emitRoomStatusChanged(
      saved.number,
      saved.status,
      saved.cleaningStatus,
    );
    return saved;
  }

  /**
   * Delete a room. Refuses if it has any non-cancelled reservations —
   * losing booking history is unacceptable. Soft-deactivate via PATCH
   * isActive=false is the way to retire a room while keeping the past.
   */
  async deleteRoom(number: number): Promise<void> {
    const room = await this.roomsRepo.findOne({ where: { number } });
    if (!room) throw new NotFoundException('Room not found');
    const hasReservations = await this.reservationsRepo.count({
      where: { roomNumber: number },
    });
    if (hasReservations > 0) {
      throw new ConflictException(
        `Room ${number} has ${hasReservations} reservation(s) on record. Deactivate instead of deleting.`,
      );
    }
    await this.roomsRepo.delete({ number });
  }

  // ─── Guests ───────────────────────────────────────────────────
  async findAllGuests(): Promise<Guest[]> {
    return this.guestsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findGuestById(id: string): Promise<Guest> {
    const guest = await this.guestsRepo.findOne({ where: { id } });
    if (!guest) throw new NotFoundException('Guest not found');
    return guest;
  }

  async createGuest(data: Partial<Guest>): Promise<Guest> {
    const guest = this.guestsRepo.create(data);
    return this.guestsRepo.save(guest);
  }

  // ─── Reservations ────────────────────────────────────────────
  async findAllReservations(): Promise<Reservation[]> {
    return this.reservationsRepo.find({
      relations: ['guest', 'group'],
      order: { createdAt: 'DESC' },
    });
  }

  async findReservationsInRange(
    from: string,
    to: string,
    roomNumber?: number,
  ): Promise<Reservation[]> {
    const qb = this.reservationsRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.guest', 'guest')
      .where('r.status IN (:...active)', {
        active: ACTIVE_RESERVATION_STATUSES,
      })
      .andWhere('r.checkInDate < :to', { to })
      .andWhere('r.checkOutDate > :from', { from })
      .orderBy('r.checkInDate', 'ASC');
    if (roomNumber) qb.andWhere('r.roomNumber = :n', { n: roomNumber });
    return qb.getMany();
  }

  async findConflicts(
    roomNumber: number,
    checkInDate: string,
    checkOutDate: string,
    excludeId?: string,
  ): Promise<Reservation[]> {
    const qb = this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.roomNumber = :n', { n: roomNumber })
      .andWhere('r.status IN (:...active)', {
        active: ACTIVE_RESERVATION_STATUSES,
      })
      .andWhere('r.checkInDate < :out', { out: checkOutDate })
      .andWhere('r.checkOutDate > :in', { in: checkInDate });
    if (excludeId) qb.andWhere('r.id != :id', { id: excludeId });
    return qb.getMany();
  }

  async createReservation(
    data: Partial<Reservation>,
    actorUserId?: string,
  ): Promise<Reservation> {
    if (!data.roomNumber || !data.checkInDate || !data.checkOutDate) {
      throw new BadRequestException(
        'roomNumber, checkInDate and checkOutDate are required',
      );
    }
    if (
      new Date(data.checkInDate as any) >= new Date(data.checkOutDate as any)
    ) {
      throw new BadRequestException(
        'checkOutDate must be later than checkInDate',
      );
    }

    const room = await this.roomsRepo.findOne({
      where: { number: data.roomNumber },
    });
    if (!room) throw new NotFoundException('Room not found');
    const numberOfGuests = data.numberOfGuests ?? 1;
    if (numberOfGuests > room.maxGuests) {
      throw new BadRequestException(
        `Room ${room.number} hosts up to ${room.maxGuests} guests, requested ${numberOfGuests}`,
      );
    }

    const conflict = await this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.roomNumber = :n', { n: data.roomNumber })
      .andWhere('r.status IN (:...active)', {
        active: ACTIVE_RESERVATION_STATUSES,
      })
      .andWhere('r.checkInDate < :out', { out: data.checkOutDate })
      .andWhere('r.checkOutDate > :in', { in: data.checkInDate })
      .getCount();
    if (conflict > 0) {
      throw new ConflictException(
        `Room ${data.roomNumber} is already booked for the requested dates`,
      );
    }

    const reservation = this.reservationsRepo.create(data);
    const saved = await this.reservationsRepo.save(reservation);

    if (saved.status === 'checked-in') {
      await this.roomsRepo.update(saved.roomNumber, {
        status: 'occupied',
        currentReservationId: saved.id,
      });
      await this.ensureFolioForReservation(saved, actorUserId);
    }

    if (saved.guestId) {
      this.guestsRepo
        .findOne({ where: { id: saved.guestId } })
        .then((guest) => {
          if (!guest) return;
          return this.outbound.notifyReservationCreated({
            email: guest.email,
            phone: guest.phone,
            guestName: `${guest.firstName} ${guest.lastName}`.trim(),
            roomNumber: saved.roomNumber,
            checkInDate: String(saved.checkInDate),
            checkOutDate: String(saved.checkOutDate),
          });
        })
        .catch(() => undefined);
    }
    return saved;
  }

  async sendCheckInReminders(): Promise<{ sent: number }> {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const upcoming = await this.reservationsRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.guest', 'guest')
      .where('r.status IN (:...active)', {
        active: ['pending', 'confirmed'],
      })
      .andWhere('r.checkInDate >= :start AND r.checkInDate < :end', {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      })
      .getMany();

    let sent = 0;
    for (const r of upcoming) {
      if (!r.guest) continue;
      await this.outbound.notifyCheckInReminder({
        email: r.guest.email,
        phone: r.guest.phone,
        guestName: `${r.guest.firstName} ${r.guest.lastName}`.trim(),
        roomNumber: r.roomNumber,
        checkInDate: String(r.checkInDate),
      });
      sent++;
    }
    return { sent };
  }

  async updateReservation(
    id: string,
    data: Partial<Reservation>,
    actorUserId?: string,
  ): Promise<Reservation> {
    const reservation = await this.reservationsRepo.findOne({
      where: { id },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    const previousStatus = reservation.status;
    Object.assign(reservation, data);
    const saved = await this.reservationsRepo.save(reservation);

    if (
      saved.status === 'checked-in' &&
      previousStatus !== 'checked-in' &&
      !saved.folioId
    ) {
      await this.ensureFolioForReservation(saved, actorUserId);
    }

    if (data.status === 'checked-in' && previousStatus !== 'checked-in') {
      await this.roomsRepo.update(saved.roomNumber, {
        status: 'occupied',
        currentReservationId: saved.id,
      });
    }
    if (data.status === 'checked-out' || data.status === 'cancelled') {
      await this.roomsRepo.update(reservation.roomNumber, {
        status: 'available',
        currentReservationId: null as any,
        cleaningStatus: 'needs-cleaning',
      });
      await this.cleaningService.create({
        roomNumber: reservation.roomNumber,
        type: 'departure',
        reservationId: reservation.id,
      });
    }
    return saved;
  }

  /**
   * Open (or reuse) the guest's folio the first time they check in, and
   * post the room-stay charge up-front so reception doesn't have to add it
   * by hand. Idempotent: if the reservation already has a folioId we skip
   * both steps; if the room charge was already written for this reservation
   * (same sourceId) we skip the charge so a double-PATCH doesn't duplicate.
   *
   * Group routing: when reservation.groupId is set AND the group is in
   * routeAllToMaster mode, the room-stay charge lands on the group's
   * master folio instead of opening a new per-room folio. The reservation
   * still gets folioId pointed at the master so subsequent POS calls find
   * the right bill.
   */
  private async ensureFolioForReservation(
    reservation: Reservation,
    actorUserId?: string,
  ): Promise<void> {
    if (reservation.folioId) return;

    let folioId: string;
    let chargesArr: any[] = [];

    if (reservation.groupId) {
      const group = await this.bookingGroupsRepo.findOne({
        where: { id: reservation.groupId },
      });
      if (group?.routeAllToMaster && group.masterFolioId) {
        const master = await this.foliosService.findById(group.masterFolioId);
        folioId = master.id;
        chargesArr = master.charges ?? [];
      } else {
        const folio = await this.foliosService.create({
          guestId: reservation.guestId,
          reservationId: reservation.id,
          roomNumber: reservation.roomNumber,
        });
        folioId = folio.id;
        chargesArr = (folio as any).charges ?? [];
      }
      // First member checks in → flip the group from pending to active.
      if (group && group.status === 'pending') {
        await this.bookingGroupsRepo.update(group.id, { status: 'active' });
      }
    } else {
      const folio = await this.foliosService.create({
        guestId: reservation.guestId,
        reservationId: reservation.id,
        roomNumber: reservation.roomNumber,
      });
      folioId = folio.id;
      chargesArr = (folio as any).charges ?? [];
    }

    reservation.folioId = folioId;
    await this.reservationsRepo.update(reservation.id, { folioId });

    const totalPrice = Number(reservation.totalPrice) || 0;
    if (totalPrice > 0) {
      const checkIn = new Date(reservation.checkInDate as any);
      const checkOut = new Date(reservation.checkOutDate as any);
      const ms = checkOut.getTime() - checkIn.getTime();
      const nights = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
      const fmt = (d: Date) =>
        `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
      const guests = reservation.numberOfGuests ?? 1;
      const description =
        `Проживание · номер ${reservation.roomNumber} · ` +
        `${nights} ноч. · ${guests} гостей · ${fmt(checkIn)}–${fmt(checkOut)}`;

      const alreadyPosted = chargesArr.some(
        (c) => c.chargeType === 'room' && c.sourceId === reservation.id,
      );
      if (!alreadyPosted) {
        await this.foliosService.addCharge(folioId, {
          chargeType: 'room',
          description,
          amount: totalPrice,
          sourceId: reservation.id,
          addedBy: actorUserId || 'system',
        });
      }
    }
  }
}
