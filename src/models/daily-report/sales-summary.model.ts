import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { SalesCategoryBreakdownItem } from './sales-category-breakdown-item.model';

const SalesCategoryBreakdownItemSchema = SchemaFactory.createForClass(
  SalesCategoryBreakdownItem,
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
}
