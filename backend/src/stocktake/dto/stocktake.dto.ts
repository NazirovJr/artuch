import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStocktakeDto {
  @IsUUID()
  warehouseId: string;

  @IsString()
  countedBy: string;

  @IsOptional()
  @IsIn(['cycle', 'full'])
  kind?: 'cycle' | 'full';

  // Limit a cycle count to one category (e.g. only "beverages").
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Optional: pre-seed lines with specific items. If omitted the service
  // auto-seeds with all active items in the warehouse (filtered by category
  // if set).
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  itemIds?: string[];
}

export class RecordCountDto {
  @IsNumber()
  @Min(0)
  actual: number;

  @IsOptional()
  @IsIn(['spoilage', 'theft', 'count_error', 'damage', 'other'])
  varianceReason?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ApproveStocktakeDto {
  @IsString()
  approvedBy: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelStocktakeDto {
  @IsString()
  cancelledBy: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
