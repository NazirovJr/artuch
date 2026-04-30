import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FoliosService } from '../folios/folios.service';
import {
  AddGroupChargeDto,
  AddGroupPaymentDto,
  AddRoomToGroupDto,
  CreateBookingGroupDto,
  UpdateBookingGroupDto,
} from './dto/booking-group.dto';
import { BookingGroup } from './entities/booking-group.entity';
import { Reservation } from './entities/reservation.entity';
import { Room } from './entities/room.entity';
import { HotelService } from './hotel.service';

@Injectable()
export class BookingGroupsService {
  constructor(
    @InjectRepository(BookingGroup)
    private groupsRepo: Repository<BookingGroup>,
    @InjectRepository(Reservation)
    private reservationsRepo: Repository<Reservation>,
    @InjectRepository(Room)
    private roomsRepo: Repository<Room>,
    @InjectDataSource() private dataSource: DataSource,
    private hotelService: HotelService,
    private foliosService: FoliosService,
  ) {}

  async findAll(status?: string): Promise<BookingGroup[]> {
    const where: any = {};
    if (status) where.status = status;
    return this.groupsRepo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['leaderGuest', 'reservations', 'reservations.guest', 'masterFolio'],
    });
  }

  async findById(id: string): Promise<BookingGroup> {
    const found = await this.groupsRepo.findOne({
      where: { id },
      relations: [
        'leaderGuest',
        'reservations',
        'reservations.guest',
        'masterFolio',
      ],
    });
    if (!found) throw new NotFoundException('Booking group not found');
    return found;
  }

  /**
   * Generate a human-friendly group code. Format: G-YYYYMM-XXXX where
   * XXXX is a zero-padded sequence (resets each month). Falls back to a
   * timestamp-based fragment if the count query fails for any reason.
   */
  private async generateCode(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `G-${y}${m}`;
    try {
      const count = await this.groupsRepo
        .createQueryBuilder('g')
        .where('g.code LIKE :p', { p: `${prefix}-%` })
        .getCount();
      return `${prefix}-${String(count + 1).padStart(4, '0')}`;
    } catch {
      return `${prefix}-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    }
  }

  /**
   * Create a group AND its master folio in one DB transaction. The folio
   * is the bill that all member-reservation charges accumulate onto;
   * having it set up before the first room is added keeps routing simple.
   */
  async create(
    data: CreateBookingGroupDto,
    actorUserId?: string,
  ): Promise<BookingGroup> {
    return this.dataSource.transaction(async (mgr) => {
      const code = data.code ?? (await this.generateCode());
      const existing = await mgr.findOne(BookingGroup, { where: { code } });
      if (existing) {
        throw new BadRequestException(`Group code "${code}" is taken`);
      }

      const group = mgr.create(BookingGroup, {
        ...data,
        code,
        status: 'pending',
        routeAllToMaster: data.routeAllToMaster ?? true,
        createdBy: actorUserId,
      });
      const saved = await mgr.save(BookingGroup, group);

      const folio = await this.foliosService.create({
        guestId: data.leaderGuestId,
        notes: `Master folio for group ${saved.code} — ${saved.name}`,
      });
      saved.masterFolioId = folio.id;
      await mgr.save(BookingGroup, saved);

      // Reload via the same transactional manager — `this.findById` would
      // use the DI'd repository on a pooled connection that can't see the
      // uncommitted INSERT in Read Committed isolation, which previously
      // surfaced as a spurious "Booking group not found" 404 on every
      // create. After COMMIT the caller still gets a fully-hydrated entity.
      const reloaded = await mgr.findOne(BookingGroup, {
        where: { id: saved.id },
        relations: [
          'leaderGuest',
          'reservations',
          'reservations.guest',
          'masterFolio',
        ],
      });
      if (!reloaded) throw new NotFoundException('Booking group not found');
      return reloaded;
    });
  }

  async update(id: string, data: UpdateBookingGroupDto): Promise<BookingGroup> {
    const found = await this.findById(id);
    if (found.status === 'closed' && data.status !== undefined) {
      throw new BadRequestException(
        'Cannot modify a closed group. Reopen via deliberate admin action.',
      );
    }
    Object.assign(found, data);
    await this.groupsRepo.save(found);
    return this.findById(id);
  }

  /**
   * Add a room to the group. Creates the underlying Reservation through
   * the existing HotelService.createReservation (which enforces capacity
   * + overlap checks) but stamps groupId so charges route correctly.
   *
   * Pricing: applies the group's discountPercent to the per-night rate
   * before computing totalPrice. Discount % is captured at add-time so
   * later edits to the group don't shift past line items.
   */
  async addRoom(
    groupId: string,
    data: AddRoomToGroupDto,
    actorUserId?: string,
  ): Promise<Reservation> {
    const group = await this.findById(groupId);
    if (group.status !== 'pending' && group.status !== 'active') {
      throw new BadRequestException(
        `Cannot add rooms to a ${group.status} group`,
      );
    }

    const checkIn = data.checkInDate ?? group.checkInDate;
    const checkOut = data.checkOutDate ?? group.checkOutDate;
    if (!checkIn || !checkOut) {
      throw new BadRequestException(
        'Group has no default dates and reservation dates are missing',
      );
    }
    if (new Date(checkIn as any) >= new Date(checkOut as any)) {
      throw new BadRequestException(
        'checkOutDate must be later than checkInDate',
      );
    }

    const room = await this.roomsRepo.findOne({
      where: { number: data.roomNumber },
    });
    if (!room) throw new NotFoundException('Room not found');

    const ms =
      new Date(checkOut as any).getTime() -
      new Date(checkIn as any).getTime();
    const nights = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));

    const baseRate = Number(room.pricePerNight) || 0;
    const discount = Number(group.discountPercent) || 0;
    const effectiveRate = baseRate * (1 - discount / 100);
    const totalPrice = +(effectiveRate * nights).toFixed(2);

    return this.hotelService.createReservation(
      {
        guestId: data.guestId ?? group.leaderGuestId,
        roomNumber: data.roomNumber,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numberOfGuests: data.numberOfGuests ?? 1,
        totalPrice,
        notes: data.notes,
        status: 'confirmed',
        groupId,
      } as Partial<Reservation>,
      actorUserId,
    );
  }

  /**
   * Remove a reservation from the group. The reservation row stays —
   * we just blank the groupId so future room charges no longer route
   * to the master folio.
   *
   * folioId handling:
   *   - pending/confirmed (not yet checked in): folioId is also blanked.
   *     A subsequent solo check-in will open a fresh per-room folio via
   *     ensureFolioForReservation. Without this, future POS posts would
   *     keep landing on the master folio after removal — a real leak.
   *   - checked-in / checked-out: folioId stays pointing at the master,
   *     because the room-charge already lives there and the folio is
   *     append-only (no orphaning historical charges).
   */
  async removeRoom(
    groupId: string,
    reservationId: string,
  ): Promise<void> {
    const reservation = await this.reservationsRepo.findOne({
      where: { id: reservationId, groupId },
    });
    if (!reservation) {
      throw new NotFoundException(
        'Reservation not found in this group',
      );
    }
    const detachFolio = ['pending', 'confirmed'].includes(reservation.status);
    reservation.groupId = null as any;
    if (detachFolio) {
      reservation.folioId = null as any;
    }
    await this.reservationsRepo.save(reservation);
  }

  /**
   * Post a direct charge to the master folio (welcome dinner, transport,
   * conference fee — anything not tied to a single room).
   */
  async addCharge(
    groupId: string,
    data: AddGroupChargeDto,
    actorUserId: string,
  ) {
    const group = await this.findById(groupId);
    if (!group.masterFolioId) {
      throw new BadRequestException('Group has no master folio');
    }
    if (group.status === 'closed' || group.status === 'cancelled') {
      throw new BadRequestException(
        `Cannot add charges to a ${group.status} group`,
      );
    }
    return this.foliosService.addCharge(group.masterFolioId, {
      chargeType: data.chargeType ?? 'service',
      description: data.description,
      amount: data.amount,
      addedBy: actorUserId,
    });
  }

  async addPayment(
    groupId: string,
    data: AddGroupPaymentDto,
    actorUserId: string,
  ) {
    const group = await this.findById(groupId);
    if (!group.masterFolioId) {
      throw new BadRequestException('Group has no master folio');
    }
    if (group.status === 'cancelled') {
      throw new BadRequestException('Cannot add payments to a cancelled group');
    }
    return this.foliosService.addPayment(group.masterFolioId, {
      amount: data.amount,
      description: data.description ?? `Оплата группы ${group.code}`,
      addedBy: actorUserId,
    });
  }

  /**
   * Close the group. Refuses if any member reservation isn't in a
   * terminal state (still pending/confirmed/checked-in) — closing while
   * guests are still in the building risks lost incidentals.
   */
  async close(id: string): Promise<BookingGroup> {
    const group = await this.findById(id);
    if (group.status === 'closed') return group;

    const stillOpen = (group.reservations ?? []).filter((r) =>
      ['pending', 'confirmed', 'checked-in'].includes(r.status),
    );
    if (stillOpen.length > 0) {
      throw new BadRequestException(
        `${stillOpen.length} reservation(s) still open. Check out or cancel them first.`,
      );
    }

    if (group.masterFolioId) {
      const folio = await this.foliosService.findById(group.masterFolioId);
      if (folio.status === 'open') {
        await this.foliosService.close(group.masterFolioId);
      }
    }

    group.status = 'closed';
    await this.groupsRepo.save(group);
    return this.findById(id);
  }

  /**
   * Cancel the group. By default fails fast if any member reservation
   * is still active (refuses to silently cancel real bookings). With
   * cascade=true, cancels every non-terminal member reservation first
   * via HotelService — which also frees the room and emits the cleaning
   * task — then flips the group.
   *
   * Cannot be used to cancel a checked-in group: real guests are in
   * the rooms; reception must check them out first.
   */
  /**
   * Build a printable statement payload: the group meta + every member
   * reservation + the master folio with all its charges sorted oldest
   * first. This is the single shape consumed by the staff-app print
   * preview / PDF / email flow, so we keep the math (subtotals, balance)
   * server-side — no risk of the client and email body disagreeing.
   */
  async getStatement(id: string) {
    const group = await this.findById(id);

    let charges: any[] = [];
    let totalAmount = 0;
    let paidAmount = 0;
    let openedAt: Date | null = null;
    let closedAt: Date | null = null;

    if (group.masterFolioId) {
      const folio = await this.foliosService.findById(group.masterFolioId);
      charges = (folio.charges ?? []).slice().sort((a: any, b: any) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return ta - tb;
      });
      totalAmount = Number(folio.totalAmount) || 0;
      paidAmount = Number(folio.paidAmount) || 0;
      openedAt = (folio as any).openedAt ?? null;
      closedAt = (folio as any).closedAt ?? null;
    }

    // Subtotals by chargeType, useful for a "summary" block on the
    // statement. Payments are kept out of the positive total so the
    // breakdown reads as "what was billed" vs "what's been paid".
    const byType: Record<string, number> = {};
    for (const c of charges) {
      const t = c.chargeType || 'other';
      const amt = Number(c.amount) || 0;
      byType[t] = (byType[t] ?? 0) + amt;
    }

    return {
      group: {
        id: group.id,
        code: group.code,
        name: group.name,
        organization: group.organization,
        contactName: group.contactName,
        contactPhone: group.contactPhone,
        contactEmail: group.contactEmail,
        leaderGuest: group.leaderGuest
          ? {
              firstName: group.leaderGuest.firstName,
              lastName: group.leaderGuest.lastName,
              phone: (group.leaderGuest as any).phone ?? null,
              email: (group.leaderGuest as any).email ?? null,
            }
          : null,
        checkInDate: group.checkInDate,
        checkOutDate: group.checkOutDate,
        status: group.status,
        discountPercent:
          group.discountPercent != null ? Number(group.discountPercent) : null,
        notes: group.notes,
        routeAllToMaster: group.routeAllToMaster,
        createdAt: group.createdAt,
      },
      reservations: (group.reservations ?? []).map((r) => ({
        id: r.id,
        reservationNumber: r.reservationNumber,
        roomNumber: r.roomNumber,
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        numberOfGuests: r.numberOfGuests,
        status: r.status,
        totalPrice: Number(r.totalPrice) || 0,
        guest: r.guest
          ? {
              firstName: r.guest.firstName,
              lastName: r.guest.lastName,
            }
          : null,
      })),
      folio: group.masterFolioId
        ? {
            id: group.masterFolioId,
            totalAmount,
            paidAmount,
            balance: +(totalAmount - paidAmount).toFixed(2),
            openedAt,
            closedAt,
            charges: charges.map((c) => ({
              id: c.id,
              chargeType: c.chargeType,
              description: c.description,
              amount: Number(c.amount) || 0,
              createdAt: c.createdAt,
            })),
            byType,
          }
        : null,
      issuedAt: new Date().toISOString(),
    };
  }

  async cancel(
    id: string,
    options: { cascade?: boolean } = {},
    actorUserId?: string,
  ): Promise<BookingGroup> {
    const group = await this.findById(id);
    if (group.status === 'cancelled' || group.status === 'closed') {
      return group;
    }

    const reservations = group.reservations ?? [];
    const checkedIn = reservations.filter((r) => r.status === 'checked-in');
    if (checkedIn.length > 0) {
      throw new BadRequestException(
        `${checkedIn.length} guest(s) currently in-house. Check them out first.`,
      );
    }

    const stillActive = reservations.filter((r) =>
      ['pending', 'confirmed'].includes(r.status),
    );

    if (stillActive.length > 0) {
      if (!options.cascade) {
        throw new BadRequestException(
          `${stillActive.length} reservation(s) still active. Cancel them first or call cancel with cascade=true.`,
        );
      }
      for (const r of stillActive) {
        await this.hotelService.updateReservation(
          r.id,
          { status: 'cancelled' },
          actorUserId,
        );
      }
    }

    group.status = 'cancelled';
    await this.groupsRepo.save(group);
    return this.findById(id);
  }
}
