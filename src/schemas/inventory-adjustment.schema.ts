import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';

// A record of why a warehouse item's quantity changed via a direct edit -
// the generic AuditLog entry InventoryController.update already gets (see
// its own @AuditLog decorator) only logs "Updated Inventory (id)", with no
// request detail, so this is the only place the actual delta/date/reason
// is ever captured. Posted automatically by InventoryService.update
// whenever `quantity` actually changes - never user-created directly, and
// never edited afterward.
@Schema()
export class InventoryAdjustment extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  inventoryId: string;

  @Prop({ required: true })
  @ApiProperty()
  quantityBefore: number;

  @Prop({ required: true })
  @ApiProperty()
  quantityAfter: number;

  // quantityAfter - quantityBefore, signed - kept alongside the two raw
  // values rather than computed at read time, same reasoning as
  // SupplierLedgerEntry.balanceAfter.
  @Prop({ required: true })
  @ApiProperty()
  delta: number;

  // The business date this adjustment reflects - editable, since a
  // correction is often logged after the fact for when it actually
  // happened, not necessarily "now".
  @Prop({ default: Date.now })
  @ApiProperty()
  date: Date;

  @Prop({ default: null })
  @ApiProperty()
  note: string;

  @Prop({ required: true })
  @ApiProperty()
  performedById: string;

  // Set only when this increase was attributed to a supplier delivery (see
  // InventoryService.update) - null for an ordinary correction.
  @Prop({ default: null })
  @ApiProperty()
  supplierId: string;
}
