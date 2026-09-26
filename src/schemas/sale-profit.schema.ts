import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { SaleProfitItem } from 'src/models/sale/sale-profit-item.model';

const SaleProfitItemSchema = SchemaFactory.createForClass(SaleProfitItem);

// The profit breakdown of one sale, recorded the moment it's created (see
// SaleService.create -> SaleProfitService.record) - deliberately its own
// collection, never merged onto Sale itself (see SaleProfitItem's own
// comment for why). Append-only; a later void doesn't edit or delete this
// entry, since status is never duplicated here - reporting instead joins
// live against the Sale's own current status (see
// SaleProfitRepository.getSummary), so a voided sale drops out of P&L
// automatically without this collection ever needing to change.
@Schema()
export class SaleProfit extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  saleId: string;

  @Prop({ required: true })
  @ApiProperty()
  shopId: string;

  // The sale's own createdAt, for period bucketing - this document's own
  // createdAt would just duplicate that (created in the same request).
  @Prop({ required: true })
  @ApiProperty()
  date: Date;

  @Prop({ type: [SaleProfitItemSchema], default: [] })
  @ApiProperty({ type: [SaleProfitItem] })
  items: SaleProfitItem[];

  // Post-discount - what the sale actually earned, not the pre-discount
  // subtotal.
  @Prop({ required: true })
  @ApiProperty()
  revenue: number;

  // Sum of each line's costPrice x quantity - discount never reduces this,
  // since it doesn't change what the goods cost.
  @Prop({ required: true })
  @ApiProperty()
  cost: number;

  @Prop({ required: true })
  @ApiProperty()
  profit: number;
}
