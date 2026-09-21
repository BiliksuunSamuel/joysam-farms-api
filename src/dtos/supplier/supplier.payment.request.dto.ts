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
import { SupplierPaymentMethod } from 'src/enums';

export class SupplierPaymentRequest {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: SupplierPaymentMethod })
  @IsEnum(SupplierPaymentMethod)
  method: SupplierPaymentMethod;

  @ApiProperty({ description: 'The shop whose cash paid the supplier' })
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
