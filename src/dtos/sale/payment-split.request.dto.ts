import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { SalePaymentMethod } from 'src/enums';

// One leg of a split sale - the service validates this is Cash or Digital
// only (Credit is never split; see SaleService.create).
export class PaymentSplitRequest {
  @ApiProperty({ enum: SalePaymentMethod })
  @IsEnum(SalePaymentMethod)
  method: SalePaymentMethod;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  // Cash leg only - how much the buyer handed over for this leg.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountTendered?: number;

  // Legacy MobileMoney leg fields - unused by a Cash+Digital split, kept
  // only so old clients/tests targeting the previous Cash+MobileMoney
  // pairing don't break the request shape.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  momoNetwork?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  momoPhone?: string;
}
