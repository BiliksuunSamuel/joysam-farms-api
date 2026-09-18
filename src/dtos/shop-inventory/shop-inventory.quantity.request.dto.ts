import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// shopId/inventoryId are set once at creation and never change - adjusting
// an assignment is a quantity update only.
export class ShopInventoryQuantityRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
