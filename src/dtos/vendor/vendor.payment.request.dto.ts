import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { VendorPaymentMethod } from 'src/enums';

export class VendorPaymentRequest {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: VendorPaymentMethod })
  @IsEnum(VendorPaymentMethod)
  method: VendorPaymentMethod;

  @ApiProperty({ description: 'The shop that received the payment' })
  @IsString()
  @IsNotEmpty()
  shopId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
