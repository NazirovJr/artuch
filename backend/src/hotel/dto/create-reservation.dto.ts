import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class CreateReservationDto {
  @IsString()
  guestId: string;

  @IsNumber()
  roomNumber: number;

  @IsDateString()
  checkInDate: string;

  @IsDateString()
  checkOutDate: string;

  @IsNumber()
  numberOfGuests: number;

  @IsOptional()
  @IsNumber()
  totalPrice?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
