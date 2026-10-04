import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SupplierPaymentMethod } from 'src/enums';

// No shopId - a supplier is paid by the business, not by any one shop's
// cash wallet (suppliers deliver to the warehouse, not to a shop), so this
// payment only ever posts against the supplier's own balance. See
// SupplierService.recordPayment.
export class SupplierPaymentRequest {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: SupplierPaymentMethod })
  @IsEnum(SupplierPaymentMethod)
  method: SupplierPaymentMethod;

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
