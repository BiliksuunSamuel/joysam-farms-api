import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { InventoryInfo } from 'src/models/inventory/inventory-info.model';

const InventoryInfoSchema = SchemaFactory.createForClass(InventoryInfo);

// One line of a Sale: a quantity of one item, sold at its price at the time
// of sale (never trusted from the client - resolved server-side).
//
// @Schema() is required even though this is never a top-level collection -
// SchemaFactory.createForClass() only discovers @Prop() fields on classes
// decorated with @Schema(); without it this embeds as empty.
@Schema({ _id: false })
export class SaleItem {
  @Prop({ required: true })
  @ApiProperty()
  inventoryId: string;

  @Prop({ type: InventoryInfoSchema, default: null })
  @ApiProperty({ type: InventoryInfo })
  inventoryInfoSnapshot: InventoryInfo;

  @Prop({ required: true })
  @ApiProperty()
  quantity: number;

  @Prop({ required: true })
  @ApiProperty()
  unitPrice: number;

  @Prop({ required: true })
  @ApiProperty()
  lineTotal: number;
}
