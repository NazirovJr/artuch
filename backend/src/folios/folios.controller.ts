import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FoliosService } from './folios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { RequireManagerPin } from '../common/decorators/require-manager-pin.decorator';
import { ManagerApprovalGuard } from '../common/guards/manager-approval.guard';
import { ManagerApprovalService } from '../auth/manager-approval.service';
import { OutboundMessageService } from '../notifications/outbound-message.service';
import { Guest } from '../hotel/entities/guest.entity';

@Controller('v2/folios')
@UseGuards(JwtAuthGuard, PoliciesGuard, ManagerApprovalGuard)
export class FoliosController {
  constructor(
    private foliosService: FoliosService,
    private managerApproval: ManagerApprovalService,
    private outbound: OutboundMessageService,
    @InjectRepository(Guest) private guestRepo: Repository<Guest>,
  ) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Folio'))
  findAll(@Query('status') status?: string) {
    return this.foliosService.findAll(status);
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Folio'))
  findById(@Param('id') id: string) {
    return this.foliosService.findById(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Folio'))
  @Audit('create', 'Folio')
  create(@Body() body: { guestId?: string; reservationId?: string; roomNumber?: number; notes?: string }) {
    return this.foliosService.create(body);
  }

  @Post(':id/charges')
  @CheckPolicies((ability) => ability.can('update', 'Folio'))
  @Audit('add-charge', 'Folio')
  addCharge(
    @Param('id') id: string,
    @Body() body: { chargeType: string; description: string; amount: number; sourceId?: string },
    @Req() req: any,
  ) {
    return this.foliosService.addCharge(id, { ...body, addedBy: req.user.id });
  }

  @Post(':id/payments')
  @CheckPolicies((ability) => ability.can('update', 'Folio'))
  @Audit('add-payment', 'Folio')
  addPayment(
    @Param('id') id: string,
    @Body() body: { amount: number; description?: string },
    @Req() req: any,
  ) {
    return this.foliosService.addPayment(id, { ...body, addedBy: req.user.id });
  }

  @Post(':id/deposits')
  @CheckPolicies((ability) => ability.can('update', 'Folio'))
  @Audit('add-deposit', 'Folio')
  addDeposit(
    @Param('id') id: string,
    @Body() body: { amount: number; description?: string },
    @Req() req: any,
  ) {
    return this.foliosService.addDeposit(id, { ...body, addedBy: req.user.id });
  }

  @Post(':id/discounts')
  @CheckPolicies((ability) => ability.can('update', 'Folio'))
  @RequireManagerPin('discount')
  @Audit('add-discount', 'Folio')
  addDiscount(
    @Param('id') id: string,
    @Body() body: { amount: number; description: string },
    @Req() req: any,
  ) {
    return this.foliosService.addDiscount(id, {
      ...body,
      addedBy: req.user.id,
      approval: req.managerApproval,
    });
  }

  @Post(':id/close')
  @CheckPolicies((ability) => ability.can('update', 'Folio'))
  @Audit('close', 'Folio')
  async close(
    @Param('id') id: string,
    @Body() body: { managerPin?: string },
  ) {
    // Conditional approval: if folio still has unpaid balance, require manager PIN.
    const balance = await this.foliosService.getBalance(id);
    if (balance.balance > 0) {
      await this.managerApproval.validatePin(body?.managerPin || '');
    }
    return this.foliosService.close(id);
  }

  /**
   * Email the HTML receipt rendered on the client to the guest on file.
   * The receipt template lives in the staff-app (`utils/folioReceiptHtml.ts`)
   * so the same markup renders in the preview WebView, the PDF, and this
   * email — no duplicated template between TS runtimes. Controller just
   * resolves the guest's email, sanitises the body, and forwards.
   */
  @Post(':id/email-receipt')
  @CheckPolicies((ability) => ability.can('update', 'Folio'))
  @Audit('email-receipt', 'Folio')
  async emailReceipt(
    @Param('id') id: string,
    @Body() body: { html?: string; subject?: string },
  ) {
    if (!body?.html || body.html.length < 20) {
      throw new BadRequestException('html body is required');
    }

    const folio = await this.foliosService.findById(id);
    if (!folio.guestId) {
      throw new BadRequestException('Folio is not linked to a guest');
    }
    const guest = await this.guestRepo.findOne({ where: { id: folio.guestId } });
    if (!guest?.email) {
      throw new BadRequestException('Guest has no email on file');
    }

    const subject =
      body.subject ||
      `Чек по фолио — ${Number(folio.totalAmount).toFixed(2)} TJS`;
    await this.outbound.sendHtmlEmail(guest.email, subject, body.html);
    return { sent: true, to: guest.email };
  }
}
