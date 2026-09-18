import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ShopInventoryStatus } from 'src/enums';

export class ShopInventoryRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  shopId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  inventoryId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiProperty({ enum: ShopInventoryStatus, required: false })
  @IsOptional()
  @IsEnum(ShopInventoryStatus)
  status?: ShopInventoryStatus;
}
