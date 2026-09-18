import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';
import { StockBreakdownGroupBy } from 'src/enums';

export class StockBreakdownFilter {
  @ApiProperty({ enum: StockBreakdownGroupBy, required: false, default: StockBreakdownGroupBy.Category })
  @IsOptional()
  @IsEnum(StockBreakdownGroupBy)
  groupBy?: StockBreakdownGroupBy;

  @ApiProperty({ required: false, description: 'Scope to one category' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false, default: 12, description: 'Top N groups, ranked by quantity' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number;
}
