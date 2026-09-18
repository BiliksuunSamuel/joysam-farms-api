import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class ShopInventoryBreakdownFilter {
  @ApiProperty({ description: 'The shop to rank items for' })
  @IsString()
  shopId: string;

  @ApiProperty({ required: false, default: 8, description: 'Top N items, ranked by expected retail value' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number;
}
