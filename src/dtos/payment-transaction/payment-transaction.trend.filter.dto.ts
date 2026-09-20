import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaymentTransactionFilter } from './payment-transaction.filter.dto';
import { PaymentTransactionTrendGroupBy } from 'src/enums';

export class PaymentTransactionTrendFilter extends PaymentTransactionFilter {
  @ApiProperty({
    enum: PaymentTransactionTrendGroupBy,
    required: false,
    default: PaymentTransactionTrendGroupBy.Day,
  })
  @IsOptional()
  @IsEnum(PaymentTransactionTrendGroupBy)
  groupBy?: PaymentTransactionTrendGroupBy;
}
