import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

export const WAREHOUSE_TRANSACTION_TYPES = [
  'income',
  'expense',
  'sale',
  'transfer',
  'return', // legacy alias — equivalent to return_customer
  'return_customer',
  'return_supplier',
  'adjustment',
  'writeoff',
] as const;

export type WarehouseTransactionType = (typeof WAREHOUSE_TRANSACTION_TYPES)[number];

export class CreateWarehouseTransactionDto {
  @IsString()
  @IsIn(WAREHOUSE_TRANSACTION_TYPES as unknown as string[])
  type: WarehouseTransactionType;

  @IsUUID()
  itemId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsString()
  performedBy: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  // FK to the suppliers directory. When set, server will also stamp
  // `supplier` with the current display name so reports without JOIN
  // still read sensibly.
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  recipient?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCost?: number;

  // Required when type === 'transfer'.
  @ValidateIf((o) => o.type === 'transfer')
  @IsUUID()
  sourceWarehouseId?: string;

  @ValidateIf((o) => o.type === 'transfer')
  @IsUUID()
  targetWarehouseId?: string;

  // Optional client-supplied UUID for retry-safe inserts. If omitted the
  // server still inserts, just without dedup protection.
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  // ─── Unit conversion (P2.2) ───────────────────────────────────
  // The unit `quantity` is expressed in. If different from the item's
  // canonical unit, the server multiplies by the configured conversion
  // factor before applying the operation. Defaults to canonical.
  @IsOptional()
  @IsString()
  inputUnit?: string;

  // ─── Lot tracking (P2.1) ───────────────────────────────────────
  // Supplied on income/return: creates a new StockLot row and downstream
  // issues consume FEFO. On other types: ignored.
  @IsOptional()
  @IsString()
  lotCode?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string; // ISO date

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;
}
