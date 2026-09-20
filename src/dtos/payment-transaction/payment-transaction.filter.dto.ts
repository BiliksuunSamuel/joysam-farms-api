import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { PaymentTransactionStatus } from 'src/enums';

export class PaymentTransactionFilter extends BaseFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({ enum: PaymentTransactionStatus, required: false })
  @IsOptional()
  @IsEnum(PaymentTransactionStatus)
  status?: PaymentTransactionStatus;

  // "mobile_money" | "card" - a free string, not an enum, since Paystack
  // is the one that defines this vocabulary (see PaymentAuthorization).
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  channel?: string;
}
