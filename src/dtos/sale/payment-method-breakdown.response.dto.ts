import { ApiProperty } from '@nestjs/swagger';
import { SalePaymentMethod } from 'src/enums';

export class PaymentMethodBreakdownPoint {
  @ApiProperty({ enum: SalePaymentMethod })
  method: SalePaymentMethod;

  @ApiProperty()
  revenue: number;
}
