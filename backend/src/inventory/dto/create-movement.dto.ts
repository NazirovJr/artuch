import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsUUID,
  Min,
} from 'class-validator';

export const INVENTORY_MOVEMENT_TYPES = [
  'income',
  'expense',
  'sale',
  'return', // legacy alias
  'return_customer',
  'return_supplier',
  'adjustment',
  'writeoff',
] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export class CreateMovementDto {
  @IsUUID()
  itemId: string;

  @IsOptional()
  @IsString()
  itemName?: string;

  @IsString()
  @IsIn(INVENTORY_MOVEMENT_TYPES as unknown as string[])
  type: InventoryMovementType;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCost?: number;

  @IsString()
  employeeId: string;

  @IsString()
  employee: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}
