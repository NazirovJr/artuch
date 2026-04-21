import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { Guest } from './entities/guest.entity';
import { Reservation } from './entities/reservation.entity';
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
    @InjectRepository(Guest) private guestsRepo: Repository<Guest>,
    @InjectRepository(Reservation) private reservationsRepo: Repository<Reservation>,
    private eventsService: EventsService,
    private foliosService: FoliosService,
    private cleaningService: CleaningService,
    private outbound: OutboundMessageService,
  ) {}

  // Rooms
  async findAllRooms(): Promise<Room[]> {
    return this.roomsRepo.find({ order: { number: 'ASC' } });
  }

  async updateRoom(number: number, data: Partial<Room>): Promise<Room> {
    const room = await this.roomsRepo.findOne({ where: { number } });
    if (!room) throw new NotFoundException('Room not found');
    Object.assign(room, data);
    const saved = await this.roomsRepo.save(room);
    this.eventsService.emitRoomStatusChanged(
      saved.number,
      saved.status,
      saved.cleaningStatus,
    );
    return saved;
  }

  // Guests
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

  // Reservations
  async findAllReservations(): Promise<Reservation[]> {
    return this.reservationsRepo.find({ relations: ['guest'], order: { createdAt: 'DESC' } });
  }

  /**
   * Find reservations for a date range, optionally constrained to a single
   * room. Used by the calendar/grid view to draw active bookings; only
   * statuses that physically hold the room count.
   */
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

  /**
   * Lightweight precheck used by the staff app before submitting a new
   * reservation — returns the conflicting reservations (empty list = OK).
   */
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
    if (new Date(data.checkInDate as any) >= new Date(data.checkOutDate as any)) {
      throw new BadRequestException(
        'checkOutDate must be later than checkInDate',
      );
    }

    // Capacity check: number of guests must not exceed room capacity.
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

    // Overlap check: no other active reservation may intersect the requested dates.
    // Two date intervals [a,b) and [c,d) overlap iff a < d AND c < b.
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

    // If the reservation is created already in checked-in state, mark the room
    // as occupied and open a folio. Otherwise leave the room as-is so the
    // grid still reflects today's actual occupancy.
    if (saved.status === 'checked-in') {
      await this.roomsRepo.update(saved.roomNumber, {
        status: 'occupied',
        currentReservationId: saved.id,
      });
      await this.ensureFolioForReservation(saved, actorUserId);
    }

    // Confirmation email/SMS — best-effort, never blocks the booking flow.
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

  /**
   * Send a 24h-before-checkin reminder for every reservation that's about to
   * start. Designed to be invoked by an external cron once a day; leaves
   * already-sent state out for now and relies on idempotent delivery.
   */
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
    const reservation = await this.reservationsRepo.findOne({ where: { id } });
    if (!reservation) throw new NotFoundException('Reservation not found');
    const previousStatus = reservation.status;
    Object.assign(reservation, data);
    const saved = await this.reservationsRepo.save(reservation);

    // Auto-open a folio the first time a reservation enters check-in so all
    // subsequent charges (POS, mini-bar, services) get tied to the guest.
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
      // Open a structured departure-cleaning task for housekeeping. The legacy
      // room.cleaningStatus flag stays in sync via CleaningService.approve().
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
   */
  private async ensureFolioForReservation(
    reservation: Reservation,
    actorUserId?: string,
  ): Promise<void> {
    if (reservation.folioId) return;

    const folio = await this.foliosService.create({
      guestId: reservation.guestId,
      reservationId: reservation.id,
      roomNumber: reservation.roomNumber,
    });
    reservation.folioId = folio.id;
    await this.reservationsRepo.update(reservation.id, { folioId: folio.id });

    // Post the room stay as the first line on the folio. Description names
    // the period + guest count so the printed bill reads naturally.
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

      // Guard against duplicate room-charge if ensureFolioForReservation
      // somehow gets called twice on the same folio (shouldn't happen after
      // the folioId check above, but cheap belt-and-suspenders).
      const charges = (folio.charges || []) as any[];
      const alreadyPosted = charges.some(
        (c) => c.chargeType === 'room' && c.sourceId === reservation.id,
      );
      if (!alreadyPosted) {
        await this.foliosService.addCharge(folio.id, {
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
