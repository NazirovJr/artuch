import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @IsIn(['available', 'occupied', 'maintenance'])
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(['clean', 'needs-cleaning', 'cleaning', 'pending'])
  cleaningStatus?: string;

  @IsOptional()
  @IsString()
  currentReservationId?: string;
}
