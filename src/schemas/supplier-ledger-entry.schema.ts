import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { SupplierLedgerEntryType, SupplierPaymentMethod } from 'src/enums';
import { ShopInfo } from 'src/models/shop/shop-info.model';

const ShopInfoSchema = SchemaFactory.createForClass(ShopInfo);

// A single entry in a supplier's payable account - the inverse of
// VendorLedgerEntry (a Vendor owes us; a Supplier is who we owe). Entries
// are append-only. `type` alone determines the effect on balance (Bill
// always increases what we owe, Payment always decreases it), so the
// running balance (balanceAfter, and the supplier's own computed balance)
// is positive once we owe money.
//
// Deliberately simpler than VendorLedgerEntry - no dueDate/outstandingAmount
// FIFO-allocation fields, since supplier bills don't carry payment terms in
// this app; a payment just reduces the running total rather than being
// allocated against a specific bill.
@Schema()
export class SupplierLedgerEntry extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  supplierId: string;

  // The business date of this entry - e.g. a payment can be backdated to
  // when it was actually made, distinct from `createdAt`. Bills are always
  // posted live (the moment a supply request is approved), so this is just
  // "now" for those.
  @Prop({ default: Date.now })
  @ApiProperty()
  date: Date;

  @Prop({ type: String, enum: SupplierLedgerEntryType, required: true })
  @ApiProperty({ enum: SupplierLedgerEntryType })
  type: SupplierLedgerEntryType;

  // Bill/Payment: always positive, effect on balance comes from `type`.
  // Adjustment: signed directly, since there's no `type`-implied direction
  // for a manual correction.
  @Prop({ required: true })
  @ApiProperty()
  amount: number;

  // The supplier's running balance immediately after this entry, for audit
  // purposes - never used to compute the balance itself.
  @Prop({ required: true })
  @ApiProperty()
  balanceAfter: number;

  // Bill only - the SupplyRequest that was approved and brought this stock
  // in. null for Payment/Adjustment.
  @Prop({ default: null })
  @ApiProperty()
  referenceId: string;

  // Payment only - the shop whose cash paid the supplier.
  @Prop({ default: null })
  @ApiProperty()
  shopId: string;

  @Prop({ type: ShopInfoSchema, default: null })
  @ApiProperty({ type: ShopInfo })
  shopInfoSnapshot: ShopInfo;

  // Payment only.
  @Prop({ type: String, enum: SupplierPaymentMethod, default: null })
  @ApiProperty({ enum: SupplierPaymentMethod })
  paymentMethod: SupplierPaymentMethod;

  // Payment: a reference/receipt number. Adjustment: the reason.
  @Prop({ default: null })
  @ApiProperty()
  reference: string;

  @Prop({ default: null })
  @ApiProperty()
  description: string;

  // null for entries the system posts on its own (a Bill from an approved
  // supply request).
  @Prop({ default: null })
  @ApiProperty()
  recordedById: string;
}
