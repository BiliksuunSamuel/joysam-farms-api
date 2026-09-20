import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { SalePaymentMethod } from 'src/enums';

// A Split sale's legs are attributed to their own method here (e.g. a
// GH₵135 Cash+Digital split contributes GH₵100 to Cash and GH₵35 to
// Digital) - never lumped under a generic "Split" bucket. See
// SaleRepository.getPaymentMethodTotals.
@Schema({ _id: false })
export class PaymentMethodBreakdownItem {
  @Prop({ enum: SalePaymentMethod, required: true })
  @ApiProperty({ enum: SalePaymentMethod })
  method: SalePaymentMethod;

  @Prop({ required: true })
  @ApiProperty()
  revenue: number;
}
