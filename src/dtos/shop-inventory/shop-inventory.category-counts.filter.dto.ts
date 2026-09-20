import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ShopInventoryCategoryCountsFilter {
  @ApiProperty({ description: 'The shop to count items for, grouped by category' })
  @IsString()
  shopId: string;
}
