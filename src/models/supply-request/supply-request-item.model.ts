import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { InventoryInfo } from 'src/models/inventory/inventory-info.model';

const InventoryInfoSchema = SchemaFactory.createForClass(InventoryInfo);

// One line of a SupplyRequest: a quantity of one item being ordered from a
// supplier for the warehouse.
//
// @Schema() is required even though this is never a top-level collection -
// SchemaFactory.createForClass() only discovers @Prop() fields on classes
// decorated with @Schema(); without it this embeds as empty.
@Schema({ _id: false })
export class SupplyRequestItem {
  @Prop({ required: true })
  @ApiProperty()
  inventoryId: string;

  @Prop({ type: InventoryInfoSchema, default: null })
  @ApiProperty({ type: InventoryInfo })
  inventoryInfoSnapshot: InventoryInfo;

  @Prop({ required: true })
  @ApiProperty()
  quantity: number;

  // This delivery's expiry, if the item is perishable - becomes the
  // Inventory's own expiryDate the moment this request is approved (see
  // SupplyRequestService.approve).
  @Prop({ default: null })
  @ApiProperty()
  expiryDate: Date;
}
