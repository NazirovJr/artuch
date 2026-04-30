import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateBookingGroupDto {
  @IsString()
  @Length(1, 200)
  name: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  code?: string;

  @IsOptional()
  @IsUUID()
  leaderGuestId?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  organization?: string;

  @IsOptional()
  @IsDateString()
  checkInDate?: string;

  @IsOptional()
  @IsDateString()
  checkOutDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  routeAllToMaster?: boolean;
}

export class UpdateBookingGroupDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsUUID()
  leaderGuestId?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  organization?: string;

  @IsOptional()
  @IsDateString()
  checkInDate?: string;

  @IsOptional()
  @IsDateString()
  checkOutDate?: string;

  @IsOptional()
  @IsIn(['pending', 'active', 'closed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsNumber()
  discountPercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  routeAllToMaster?: boolean;
}

export class AddRoomToGroupDto {
  @IsNumber()
  roomNumber: number;

  @IsOptional()
  @IsUUID()
  guestId?: string;

  // Defaults to group dates if omitted.
  @IsOptional()
  @IsDateString()
  checkInDate?: string;

  @IsOptional()
  @IsDateString()
  checkOutDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  numberOfGuests?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

// Charge types accepted on a master folio. Excludes 'room' (only the
// hotel service emits those, tied to a reservation) and 'payment'/'refund'
// (use the dedicated payment endpoint).
const GROUP_CHARGE_TYPES = [
  'restaurant',
  'bar',
  'shop',
  'rental',
  'service',
  'discount',
] as const;

export class AddGroupChargeDto {
  @IsString()
  @Length(1, 255)
  description: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsIn(GROUP_CHARGE_TYPES as unknown as string[])
  chargeType?: (typeof GROUP_CHARGE_TYPES)[number];
}

export class AddGroupPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  description?: string;
}

export class CancelBookingGroupDto {
  // When true, also cancels all non-terminal member reservations (pending,
  // confirmed, checked-in) before flipping the group to cancelled. Without
  // this flag the request fails if any active reservation remains.
  @IsOptional()
  @IsBoolean()
  cascade?: boolean;
}
