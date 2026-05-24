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
  'rent',
  'payroll',
  'utilities',
  'supplies',
  'transport',
  'marketing',
  'maintenance',
  'tax',
  'other',
];

export class CreateExpenseDto {
  @IsString()
  categoryId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: string;

  // Business date the money left (YYYY-MM-DD).
  @IsDateString()
  spentAt: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsString()
  outletId?: string;
}

export class VoidExpenseDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateExpenseCategoryDto {
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

export class UpdateExpenseCategoryDto {
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
