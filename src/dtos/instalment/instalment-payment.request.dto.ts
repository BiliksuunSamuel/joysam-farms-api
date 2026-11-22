import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SalePaymentMethod } from 'src/enums';

export class InstalmentPaymentRequest {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  // Cash or manual mobile money only.
  @ApiProperty({ enum: [SalePaymentMethod.Cash, SalePaymentMethod.MobileMoney] })
  @IsIn([SalePaymentMethod.Cash, SalePaymentMethod.MobileMoney])
  method: SalePaymentMethod;

  @ApiProperty({ description: 'The shop that took the payment' })
  @IsString()
  @IsNotEmpty()
  shopId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountTendered?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  momoNetwork?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  momoPhone?: string;
}

export class InstalmentCancelRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  reason: string;

  // How the refund is handed back - it comes out of the till (cash) or goes
  // out from the business mobile money account. Cash when omitted.
  @ApiProperty({
    required: false,
    enum: [SalePaymentMethod.Cash, SalePaymentMethod.MobileMoney],
  })
  @IsOptional()
  @IsIn([SalePaymentMethod.Cash, SalePaymentMethod.MobileMoney])
  refundMethod?: SalePaymentMethod;
}
