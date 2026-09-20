import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { VendorStatus } from 'src/enums';
import { IsValidPhoneNumber } from 'src/decorators/is-valid-phone-number.decorator';

export class VendorRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  contactName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsValidPhoneNumber()
  phone?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ required: false, description: 'Payment terms, in days' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  termsDays?: number;

  @ApiProperty({ enum: VendorStatus, required: false })
  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;

  // ---- Credit policy ----

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  blockCreditIfAnyOutstanding?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  blockCreditIfOverdue?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  creditOverdueGraceDays?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxOutstandingCreditBalance?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxOpenCreditSales?: number | null;
}
