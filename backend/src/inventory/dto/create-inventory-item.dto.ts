import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  name: string;

  @IsNumber()
  price: number;

  @IsNumber()
  purchasePrice: number;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsNumber()
  stock: number;

  @IsNumber()
  minStock: number;

  @IsString()
  unit: string;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsNumber()
  pricePerLiter?: number;
}
