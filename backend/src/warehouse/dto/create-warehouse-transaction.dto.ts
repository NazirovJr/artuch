import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';

export class CreateWarehouseTransactionDto {
  @IsString()
  @IsIn(['income', 'expense'])
  type: string;

  @IsString()
  itemId: string;

  @IsNumber()
  quantity: number;

  @IsString()
  performedBy: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  recipient?: string;

  @IsOptional()
  @IsNumber()
  totalCost?: number;
}
