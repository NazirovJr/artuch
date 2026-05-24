import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Folio } from './entities/folio.entity';
import { FolioCharge } from './entities/folio-charge.entity';
import { Guest } from '../hotel/entities/guest.entity';
import { EventsService } from '../events/events.service';
import { OutboundMessageService } from '../notifications/outbound-message.service';

@Injectable()
export class FoliosService {
  constructor(
    @InjectRepository(Folio) private folioRepo: Repository<Folio>,
    @InjectRepository(FolioCharge) private chargeRepo: Repository<FolioCharge>,
    @InjectRepository(Guest) private guestRepo: Repository<Guest>,
    private eventsService: EventsService,
    private outbound: OutboundMessageService,
  ) {}

  async findAll(status?: string): Promise<Folio[]> {
    const where: any = {};
    if (status) where.status = status;
    return this.folioRepo.find({
      where,
      relations: ['charges'],
      order: { openedAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Folio> {
    const folio = await this.folioRepo.findOne({
      where: { id },
      relations: ['charges'],
    });
    if (!folio) throw new NotFoundException('Folio not found');
    return folio;
  }

  async create(data: {
    guestId?: string;
    reservationId?: string;
    roomNumber?: number;
    notes?: string;
  }): Promise<Folio> {
    // Service-level dedup: a reservation has at most one open folio. Without
    // this, a quick double-PATCH of `status: 'checked-in'` or a retry from
    // the UI would create two folios in parallel (there's no DB UNIQUE on
    // reservationId because historical re-bookings may reuse it after close).
    if (data.reservationId) {
      const existing = await this.folioRepo.findOne({
        where: { reservationId: data.reservationId, status: 'open' },
      });
      if (existing) return existing;
    }

    const folio = this.folioRepo.create({
      guestId: data.guestId || undefined,
      reservationId: data.reservationId || undefined,
      roomNumber: data.roomNumber || undefined,
      notes: data.notes || undefined,
      status: 'open',
      totalAmount: 0,
      paidAmount: 0,
    });
    return this.folioRepo.save(folio);
  }

  async addCharge(
    folioId: string,
    data: {
      chargeType: string;
      description: string;
      amount: number;
      sourceId?: string;
      addedBy: string;
      quantity?: number;
      unitPrice?: number;
    },
  ): Promise<FolioCharge> {
    const folio = await this.findById(folioId);
    if (folio.status === 'closed') {
      throw new BadRequestException('Cannot add charge to a closed folio');
    }

    const charge = this.chargeRepo.create({
      folioId,
      chargeType: data.chargeType,
      description: data.description,
      amount: Math.abs(data.amount), // charges are positive
      sourceId: data.sourceId || undefined,
      addedBy: data.addedBy,
      quantity: data.quantity ?? null,
      unitPrice: data.unitPrice ?? null,
    });
    const saved = await this.chargeRepo.save(charge);
    await this.recalculate(folioId);
    return saved;
  }

  /**
   * Record a guest deposit / prepayment. Stored as a negative-amount charge
   * with chargeType='deposit' so it applies to the folio balance immediately.
   * On no-show, the booking is cancelled but the deposit stays on the folio,
   * which is why it must live as its own line item rather than as a regular
   * 'payment' (so reports can separate "kept on no-show" from real payments).
   */
  async addDeposit(
    folioId: string,
    data: { amount: number; addedBy: string; description?: string },
  ): Promise<FolioCharge> {
    const folio = await this.findById(folioId);
    if (folio.status === 'closed') {
      throw new BadRequestException('Cannot add deposit to a closed folio');
    }
    const charge = this.chargeRepo.create({
      folioId,
      chargeType: 'deposit',
      description: data.description || 'Депозит',
      amount: -Math.abs(data.amount),
      addedBy: data.addedBy,
    });
    const saved = await this.chargeRepo.save(charge);
    await this.recalculate(folioId);
    return saved;
  }

  async addPayment(
    folioId: string,
    data: { amount: number; addedBy: string; description?: string },
  ): Promise<FolioCharge> {
    const folio = await this.findById(folioId);
    if (folio.status === 'closed') {
      throw new BadRequestException('Cannot add payment to a closed folio');
    }

    const charge = this.chargeRepo.create({
      folioId,
      chargeType: 'payment',
      description: data.description || 'Оплата',
      amount: -Math.abs(data.amount), // payments are negative
      addedBy: data.addedBy,
    });
    const saved = await this.chargeRepo.save(charge);
    await this.recalculate(folioId);
    return saved;
  }

  async addDiscount(
    folioId: string,
    data: {
      amount: number;
      description: string;
      addedBy: string;
      approval?: { userId: string; reason: string; approvedAt: Date };
    },
  ): Promise<FolioCharge> {
    const folio = await this.findById(folioId);
    if (folio.status === 'closed') {
      throw new BadRequestException('Cannot add discount to a closed folio');
    }

    const charge = this.chargeRepo.create({
      folioId,
      chargeType: 'discount',
      description: data.description || 'Скидка',
      amount: -Math.abs(data.amount), // discounts are negative
      addedBy: data.addedBy,
      approvedBy: data.approval?.userId,
      approvedAt: data.approval?.approvedAt ?? null,
      approvalReason: data.approval?.reason,
    });
    const saved = await this.chargeRepo.save(charge);
    await this.recalculate(folioId);

    const amount = Math.abs(data.amount);
    const folioTotal = Number(folio.totalAmount) || 0;
    const ratio = folioTotal > 0 ? amount / folioTotal : 0;
    this.eventsService.emitRiskyAction({
      type: 'discount',
      severity: ratio >= 0.2 ? 'warning' : 'info',
      title: `Скидка ${amount.toFixed(2)} TJS`,
      detail: data.description,
      actorId: data.addedBy,
      amount,
      subjectId: folioId,
      subject: 'Folio',
    });

    return saved;
  }

  async close(folioId: string): Promise<Folio> {
    const folio = await this.findById(folioId);
    if (folio.status === 'closed') {
      throw new BadRequestException('Folio is already closed');
    }

    folio.status = 'closed';
    folio.closedAt = new Date();
    const saved = await this.folioRepo.save(folio);

    // Best-effort receipt email/SMS — never blocks the close itself.
    if (saved.guestId) {
      this.guestRepo
        .findOne({ where: { id: saved.guestId } })
        .then((guest) => {
          if (!guest) return;
          return this.outbound.notifyFolioClosed({
            email: guest.email,
            phone: guest.phone,
            guestName: `${guest.firstName} ${guest.lastName}`.trim(),
            folioId: saved.id,
            totalAmount: Number(saved.totalAmount) || 0,
            paidAmount: Number(saved.paidAmount) || 0,
          });
        })
        .catch(() => undefined);
    }
    return saved;
  }

  async getBalance(folioId: string): Promise<{ totalAmount: number; paidAmount: number; balance: number }> {
    const folio = await this.findById(folioId);
    const balance = Number(folio.totalAmount) - Number(folio.paidAmount);
    return {
      totalAmount: Number(folio.totalAmount),
      paidAmount: Number(folio.paidAmount),
      balance,
    };
  }

  private async recalculate(folioId: string): Promise<void> {
    const charges = await this.chargeRepo.find({ where: { folioId } });

    let totalAmount = 0;
    let paidAmount = 0;

    for (const charge of charges) {
      const amt = Number(charge.amount);
      if (amt > 0) {
        totalAmount += amt;
      } else if (
        charge.chargeType === 'payment' ||
        charge.chargeType === 'deposit'
      ) {
        // payments and prepaid deposits both lower the outstanding balance
        // (they don't reduce the room/services total).
        paidAmount += Math.abs(amt);
      } else {
        // discounts/refunds reduce totalAmount
        totalAmount += amt; // amt is already negative
      }
    }

    await this.folioRepo.update(folioId, {
      totalAmount: Math.max(0, totalAmount),
      paidAmount,
    });
  }
}
