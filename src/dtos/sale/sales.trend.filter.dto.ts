import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SaleFilter } from './sale.filter.dto';
import { SalesTrendGroupBy } from 'src/enums';

export class SalesTrendFilter extends SaleFilter {
  @ApiProperty({ enum: SalesTrendGroupBy, required: false, default: SalesTrendGroupBy.Day })
  @IsOptional()
  @IsEnum(SalesTrendGroupBy)
  groupBy?: SalesTrendGroupBy;

  // When set, the trend is scoped to just this item within each sale
  // (sale.items is an array, so this un-nests it) - value1/value2 then mean
  // units sold / revenue from this item, instead of sale revenue / count.
  @ApiProperty({ required: false, description: 'Scope the trend to one inventory item' })
  @IsOptional()
  @IsString()
  inventoryId?: string;
}
