import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateTransferDto {
  @IsUUID()
  sourceWarehouseId: string;

  @IsUUID()
  targetWarehouseId: string;

  // The source-warehouse WarehouseItem row to draw from.
  @IsUUID()
  sourceItemId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsString()
  createdBy: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}

export class ReceiveTransferDto {
  @IsString()
  receivedBy: string;

  // Defaults to the original sent quantity. Override when the receiving end
  // counts a different number — the variance is preserved on the transfer.
  @IsOptional()
  @IsNumber()
  @Min(0)
  receivedQuantity?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelTransferDto {
  @IsString()
  cancelledBy: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
