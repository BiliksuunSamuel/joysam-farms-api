import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StockRequestTrendGroupBy } from 'src/enums';

/** Not paginated - stands alone rather than extending StockRequestFilter/BaseFilter, which require page/pageSize. */
export class StockRequestTrendFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shopId?: string;

  // value2 means "how many were approved" either way - of requests this
  // person raised, or of requests this person reviewed (approved or
  // rejected).
  @ApiProperty({ required: false, description: 'Scope to requests raised by this person' })
  @IsOptional()
  @IsString()
  requestedById?: string;

  @ApiProperty({ required: false, description: 'Scope to requests reviewed by this person' })
  @IsOptional()
  @IsString()
  reviewedById?: string;

  @ApiProperty({ enum: StockRequestTrendGroupBy, required: false, default: StockRequestTrendGroupBy.Day })
  @IsOptional()
  @IsEnum(StockRequestTrendGroupBy)
  groupBy?: StockRequestTrendGroupBy;

  @ApiProperty({ required: false, description: 'start date for filter' })
  @IsOptional()
  startDate?: Date;

  @ApiProperty({ required: false, description: 'end date for filter' })
  @IsOptional()
  endDate?: Date;
}
