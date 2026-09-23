import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { InventoryInfo } from 'src/models/inventory/inventory-info.model';

const InventoryInfoSchema = SchemaFactory.createForClass(InventoryInfo);

// A record of stock a supplier actually delivered - the inventory-side
// counterpart to SupplierLedgerEntry (which tracks what we owe them for it).
// Posted automatically, one entry per delivery: either one SupplyRequest
// line item at approval time (see SupplyRequestService.approve), or a new
// item's own initial quantity at creation time, when it names a supplier
// (see InventoryService.create). Append-only, system-posted only - there's
// no manual entry point yet.
@Schema()
export class SupplierInventoryLedgerEntry extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  supplierId: string;

  @Prop({ required: true })
  @ApiProperty()
  inventoryId: string;

  @Prop({ type: InventoryInfoSchema, required: true })
  @ApiProperty({ type: InventoryInfo })
  inventoryInfoSnapshot: InventoryInfo;

  @Prop({ required: true })
  @ApiProperty()
  quantity: number;

  // This delivery's expiry, if the item is perishable.
  @Prop({ default: null })
  @ApiProperty()
  expiryDate: Date;

  @Prop({ default: Date.now })
  @ApiProperty()
  date: Date;

  // The record that brought this delivery in - the approved SupplyRequest's
  // id, or the new Inventory item's own id when set at creation time.
  @Prop({ required: true })
  @ApiProperty()
  referenceId: string;
}
