import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { LedgerEntryType } from 'src/enums';

// A manual correction/adjustment to a shop's wallet - the only way to post
// a ledger entry directly, rather than as a side effect of another feature.
export class LedgerAdjustmentRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  shopId: string;

  @ApiProperty({ enum: LedgerEntryType })
  @IsNotEmpty()
  @IsEnum(LedgerEntryType)
  type: LedgerEntryType;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
