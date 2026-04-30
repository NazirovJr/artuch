import {
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

/**
 * Payload for creating a new warehouse item (SKU). Categories are stored
 * inline as varchar(20) — there's no separate categories table — so the
 * client may pass an existing label ("products", "beverages", …) or a
 * brand-new one and it'll be created on first use.
 *
 * `quantity` is the *initial* on-hand stock. When > 0 the service also
 * writes an opening StockMovement row so the audit log shows where the
 * count came from instead of an unexplained baseline.
 */
export class CreateWarehouseItemDto {
  @IsString()
  @Length(1, 200)
  name: string;

  @IsString()
  @Length(1, 20)
  category: string;

  @IsString()
  @Length(1, 20)
  unit: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  barcode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  parLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderPoint?: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  warehouseId?: string;
}
