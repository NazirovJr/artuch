import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';

@Controller('v2/shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  /** Open a new shift for the authenticated user. */
  @Post('open')
  @Roles(
    'cashier',
    'shop-seller',
    'bartender',
    'barman',
    'waiter',
    'manager',
    'admin',
    'owner',
  )
  @Audit('open', 'Shift')
  open(
    @Req() req: any,
    @Body() body: { openingCash?: number; outletId?: string },
  ) {
    const user = req.user;
    return this.shiftsService.open({
      userId: user.sub || user.id,
      userName: user.username,
      outletId: body.outletId,
      openingCash: body.openingCash ?? 0,
    });
  }

  /** Close the shift with a blind cash count. */
  @Post(':id/close')
  @Roles(
    'cashier',
    'shop-seller',
    'bartender',
    'barman',
    'waiter',
    'manager',
    'admin',
    'owner',
  )
  @Audit('close', 'Shift')
  close(
    @Param('id') id: string,
    @Body() body: { actualCash: number; managerPin?: string; notes?: string },
  ) {
    return this.shiftsService.close(id, body);
  }

  /** Returns the active (open) shift for the authenticated user, or 204 null. */
  @Get('active')
  @Roles(
    'cashier',
    'shop-seller',
    'bartender',
    'barman',
    'waiter',
    'manager',
    'admin',
    'owner',
  )
  active(@Req() req: any) {
    return this.shiftsService.findActiveByUser(req.user.sub || req.user.id);
  }

  /** List shifts (admin/manager). */
  @Get()
  @Roles('manager', 'admin', 'owner')
  findAll(
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.shiftsService.findAll({ userId, from, to, status });
  }
}
