import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Get()
  findAll(@Request() req: any) {
    if (req.user.role === 'admin' || req.user.role === 'owner') {
      return this.bookingsService.findAll();
    }
    return this.bookingsService.findAll(req.user.sub);
  }

  @Post()
  create(@Body() body: any, @Request() req: any) {
    return this.bookingsService.create({ ...body, userId: req.user.sub });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.bookingsService.update(id, body);
  }
}
