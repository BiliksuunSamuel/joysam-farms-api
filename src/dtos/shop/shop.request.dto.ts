import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ShopStatus, ShopType } from 'src/enums';
import { IsValidPhoneNumber } from 'src/decorators/is-valid-phone-number.decorator';
import { OperatingHourRequest } from './operating-hour.request.dto';

export class ShopRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsValidPhoneNumber()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiProperty({ enum: ShopStatus, required: false })
  @IsOptional()
  @IsEnum(ShopStatus)
  status?: ShopStatus;

  @ApiProperty({ enum: ShopType, required: false })
  @IsOptional()
  @IsEnum(ShopType)
  type?: ShopType;

  @ApiProperty({ type: [OperatingHourRequest], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OperatingHourRequest)
  operatingHours?: OperatingHourRequest[];

  @ApiProperty({
    required: false,
    description: 'Monthly sales target, for analytics pacing',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salesMonthTarget?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  receiptPrefix?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  allowCreditSales?: boolean;
}
