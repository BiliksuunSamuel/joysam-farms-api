import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

// Only quantity comes from the client - price is always resolved
// server-side from the item's current catalog price, never trusted here.
export class SaleItemRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  inventoryId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}
