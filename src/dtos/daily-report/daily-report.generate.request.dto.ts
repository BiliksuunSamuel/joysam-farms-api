import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class DailyReportGenerateRequest {
  @ApiProperty({
    required: false,
    description:
      'Omit to (re)generate the organisation-wide rollup instead of a single shop report',
  })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({
    description:
      'Calendar date (any ISO string - only the UTC calendar day it falls on is used)',
  })
  @IsDateString()
  date: string;
}
