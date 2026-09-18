import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class SupplyRequestItemRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  inventoryId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}
