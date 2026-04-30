import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateRoomDto {
  @IsInt()
  @Min(1)
  number: number;

  // FK to RoomType. When set, room inherits beds/maxGuests/pricePerNight
  // defaults from the type — DTO can override per-room if needed.
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  // Legacy string type — still required for v1 compat. The service fills
  // it from RoomType.code when only roomTypeId is given.
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsInt()
  beds?: number;

  @IsOptional()
  @IsInt()
  maxGuests?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerNight?: number;

  @IsOptional()
  @IsInt()
  floor?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRoomDtoExtended {
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsInt()
  beds?: number;

  @IsOptional()
  @IsInt()
  maxGuests?: number;

  @IsOptional()
  @IsNumber()
  pricePerNight?: number;

  @IsOptional()
  @IsInt()
  floor?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  cleaningStatus?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkCreateRoomsDto {
  @IsUUID()
  roomTypeId: string;

  // Either provide explicit numbers, OR `from` + `count` to auto-generate.
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  numbers?: number[];

  @IsOptional()
  @IsInt()
  from?: number;

  @IsOptional()
  @IsInt()
  count?: number;

  @IsOptional()
  @IsInt()
  floor?: number;
}
