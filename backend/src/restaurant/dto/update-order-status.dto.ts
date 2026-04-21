import { IsString, IsIn } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsString()
  @IsIn(['pending', 'preparing', 'ready', 'completed', 'cancelled'])
  status: string;
}
