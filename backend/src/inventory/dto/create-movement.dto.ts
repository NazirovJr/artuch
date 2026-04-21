import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';

export class CreateMovementDto {
  @IsString()
  itemId: string;

  @IsString()
  itemName: string;

  @IsString()
  @IsIn(['income', 'expense', 'sale'])
  type: string;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
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
}
