import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const PAYMENT_METHODS = ['cash', 'card', 'bank', 'other'];
const GROUPS = [
  'service',
  'rent',
  'event',
  'asset',
  'partner',
  'grant',
  'other',
];

export class CreateIncomeDto {
  @IsString()
  categoryId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: string;

  // Business date the money arrived (YYYY-MM-DD).
  @IsDateString()
  receivedAt: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  payer?: string;

  @IsOptional()
  @IsString()
  outletId?: string;
}

export class VoidIncomeDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateIncomeCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(GROUPS)
  group?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateIncomeCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(GROUPS)
  group?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
