import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateRoomTypeDto {
  // Slug; lowercase letters, digits and dashes — used for chips and OTA codes.
  @IsString()
  @Length(2, 30)
  @Matches(/^[a-z][a-z0-9-]*$/, {
    message: 'code must be lowercase slug (a-z, 0-9, dashes)',
  })
  code: string;

  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  nameEn?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxGuests?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  maxAdults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  maxChildren?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  beds?: number;

  @IsOptional()
  @IsString()
  bedConfiguration?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  sizeM2?: number;

  @IsOptional()
  @IsString()
  view?: string;

  @IsNumber()
  @Min(0)
  basePrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weekendPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsOptional()
  @IsBoolean()
  taxIncluded?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsString()
  coverPhoto?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsBoolean()
  smokingAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  petsAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  accessibleForDisabled?: boolean;

  @IsOptional()
  @IsBoolean()
  childrenAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  breakfastIncluded?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  minStayNights?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxStayNights?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateRoomTypeDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxGuests?: number;

  @IsOptional()
  @IsInt()
  maxAdults?: number;

  @IsOptional()
  @IsInt()
  maxChildren?: number;

  @IsOptional()
  @IsInt()
  beds?: number;

  @IsOptional()
  @IsString()
  bedConfiguration?: string;

  @IsOptional()
  @IsNumber()
  sizeM2?: number;

  @IsOptional()
  @IsString()
  view?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsNumber()
  weekendPrice?: number;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @IsBoolean()
  taxIncluded?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsString()
  coverPhoto?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsBoolean()
  smokingAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  petsAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  accessibleForDisabled?: boolean;

  @IsOptional()
  @IsBoolean()
  childrenAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  breakfastIncluded?: boolean;

  @IsOptional()
  @IsInt()
  minStayNights?: number;

  @IsOptional()
  @IsInt()
  maxStayNights?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
