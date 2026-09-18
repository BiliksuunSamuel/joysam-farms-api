import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class TransferRequest {
  // Omit for a warehouse -> shop transfer ("stocking a shop"); set for a
  // shop -> shop transfer.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fromShopId?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  toShopId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  inventoryId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;
}
