import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethodBreakdownItem } from './payment-method-breakdown-item.model';
import { SalesCategoryBreakdownItem } from './sales-category-breakdown-item.model';

const SalesCategoryBreakdownItemSchema = SchemaFactory.createForClass(
  SalesCategoryBreakdownItem,
);
const PaymentMethodBreakdownItemSchema = SchemaFactory.createForClass(
  PaymentMethodBreakdownItem,
);

@Schema({ _id: false })
export class SalesSummary {
  @Prop({ required: true })
  @ApiProperty()
  revenue: number;

  @Prop({ required: true })
  @ApiProperty()
  transactionCount: number;

  @Prop({ required: true })
  @ApiProperty()
  unitsSold: number;

  @Prop({ type: [SalesCategoryBreakdownItemSchema], default: [] })
  @ApiProperty({ type: [SalesCategoryBreakdownItem] })
  categoryBreakdown: SalesCategoryBreakdownItem[];

  @Prop({ type: [PaymentMethodBreakdownItemSchema], default: [] })
  @ApiProperty({ type: [PaymentMethodBreakdownItem] })
  paymentMethodBreakdown: PaymentMethodBreakdownItem[];

  // How many sales were split between Cash and Mobile Money, and their
  // combined total value before being divided into legs - see
  // SaleRepository.getSplitSalesTotals.
  @Prop({ required: true })
  @ApiProperty()
  splitSalesCount: number;

  @Prop({ required: true })
  @ApiProperty()
  splitSalesValue: number;
}
