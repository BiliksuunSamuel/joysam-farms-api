import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';

export class DailyReportFilter extends BaseFilter {
  @ApiProperty({
    required: false,
    description: 'Omit for the organisation-wide rollup history',
  })
  @IsOptional()
  @IsString()
  shopId?: string;
}
