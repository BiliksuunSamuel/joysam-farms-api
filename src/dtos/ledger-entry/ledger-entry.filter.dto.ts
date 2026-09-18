import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { LedgerEntryType, LedgerSource } from 'src/enums';

export class LedgerEntryFilter extends BaseFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  walletId?: string;

  @ApiProperty({ enum: LedgerEntryType, required: false })
  @IsOptional()
  @IsEnum(LedgerEntryType)
  type?: LedgerEntryType;

  @ApiProperty({ enum: LedgerSource, required: false })
  @IsOptional()
  @IsEnum(LedgerSource)
  source?: LedgerSource;
}
