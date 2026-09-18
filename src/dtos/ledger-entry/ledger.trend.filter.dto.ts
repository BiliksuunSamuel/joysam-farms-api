import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LedgerTrendGroupBy } from 'src/enums';

/** Not paginated - stands alone rather than extending LedgerEntryFilter/BaseFilter, which require page/pageSize. */
export class LedgerTrendFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({ enum: LedgerTrendGroupBy, required: false, default: LedgerTrendGroupBy.Day })
  @IsOptional()
  @IsEnum(LedgerTrendGroupBy)
  groupBy?: LedgerTrendGroupBy;

  @ApiProperty({ required: false, description: 'start date for filter' })
  @IsOptional()
  startDate?: Date;

  @ApiProperty({ required: false, description: 'end date for filter' })
  @IsOptional()
  endDate?: Date;
}
