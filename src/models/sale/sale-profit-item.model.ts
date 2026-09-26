import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

// One line's contribution to a sale's profit breakdown - the reason this
// lives here rather than on SaleItem itself: SaleService returns the raw
// Sale document directly over the API (no response-shaping layer), so
// anything added to SaleItem would be visible to every caller with plain
// sale.view - including cashiers reading a receipt. Cost/margin data stays
// isolated on SaleProfit, which only the profit-and-loss endpoint touches.
//
// @Schema() is required even though this is never a top-level collection -
// SchemaFactory.createForClass() only discovers @Prop() fields on classes
// decorated with @Schema(); without it this embeds as empty.
@Schema({ _id: false })
export class SaleProfitItem {
  @Prop({ required: true })
  @ApiProperty()
  inventoryId: string;

  @Prop({ required: true })
  @ApiProperty()
  name: string;

  @Prop({ required: true })
  @ApiProperty()
  quantity: number;

  @Prop({ required: true })
  @ApiProperty()
  unitPrice: number;

  // The item's costPrice at the moment of sale - never re-read live, so
  // this stays accurate even if the item's cost changes afterward.
  @Prop({ required: true })
  @ApiProperty()
  costPrice: number;

  @Prop({ required: true })
  @ApiProperty()
  revenue: number;

  @Prop({ required: true })
  @ApiProperty()
  cost: number;
}
