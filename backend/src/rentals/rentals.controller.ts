import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';

@Controller('rentals')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class RentalsController {
  constructor(private rentalsService: RentalsService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Rental'))
  findAll(@Query('status') status?: string) {
    return this.rentalsService.findAll(status);
  }

  @Get('overdue')
  @CheckPolicies((ability) => ability.can('read', 'Rental'))
  findOverdue() {
    return this.rentalsService.findOverdue();
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Rental'))
  findById(@Param('id') id: string) {
    return this.rentalsService.findById(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Rental'))
  create(@Body() body: any, @Request() req: any) {
    return this.rentalsService.create({
      ...body,
      issuedBy: req.user.sub,
      issuedByName: req.user.fullName || req.user.username,
    });
  }

  @Patch(':id/return')
  @CheckPolicies((ability) => ability.can('update', 'Rental'))
  returnRental(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.rentalsService.returnRental(id, {
      returnedBy: req.user.sub,
      returnedByName: req.user.fullName || req.user.username,
      condition: body.condition,
      damageNote: body.damageNote,
      damageFee: body.damageFee,
      writeOffOnDamage: body.writeOffOnDamage,
    });
  }

  @Patch(':id/extend')
  @CheckPolicies((ability) => ability.can('update', 'Rental'))
  extendRental(@Param('id') id: string, @Body() body: any) {
    return this.rentalsService.extendRental(id, new Date(body.newDate));
  }
}
