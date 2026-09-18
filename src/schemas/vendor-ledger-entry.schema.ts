import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { VendorLedgerEntryType, VendorPaymentMethod } from 'src/enums';
import { ShopInfo } from 'src/models/shop/shop-info.model';

const ShopInfoSchema = SchemaFactory.createForClass(ShopInfo);

// A single entry in a vendor's credit account - entries are append-only,
// same as a shop's LedgerEntry. There's no separate "direction" field:
// `type` alone determines the effect on balance (Charge always increases
// what's owed, Payment always decreases it), so the running balance
// (balanceAfter, and the vendor's own computed balance) is negative once
// they owe money - the same way a customer's own statement would read it.
@Schema()
export class VendorLedgerEntry extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  vendorId: string;

  // The business date of this entry - e.g. a payment can be backdated to
  // when it was actually received, distinct from `createdAt` (when the
  // record was entered). Charges/Adjustments are always posted live, so
  // this is just "now" for those.
  @Prop({ default: Date.now })
  @ApiProperty()
  date: Date;

  @Prop({ enum: VendorLedgerEntryType, required: true })
  @ApiProperty({ enum: VendorLedgerEntryType })
  type: VendorLedgerEntryType;

  // Charge/Payment: always positive, effect on balance comes from `type`.
  // Adjustment: signed directly (e.g. +50 forgives 50 of debt, -50 adds 50)
  // since there's no `type`-implied direction for a manual correction.
  @Prop({ required: true })
  @ApiProperty()
  amount: number;

  // The vendor's running balance immediately after this entry, for audit
  // purposes - never used to compute the balance itself.
  @Prop({ required: true })
  @ApiProperty()
  balanceAfter: number;

  // Charge only - when this charge is due, computed from the vendor's
  // termsDays at the time of the sale.
  @Prop({ default: null })
  @ApiProperty()
  dueDate: Date;

  // Charge only - how much of this specific charge is still unpaid.
  // Decremented by FIFO as payments are recorded (oldest charge first),
  // which is what makes real invoice-level aging possible instead of
  // approximating it from the vendor's total balance.
  @Prop({ default: null })
  @ApiProperty()
  outstandingAmount: number;

  // The order (Sale) this entry belongs to. Charge: the sale that created
  // it. Payment: the sale it was allocated against - a single payment that
  // settles several outstanding orders is split into one Payment entry per
  // order, each carrying that order's own id here (see
  // VendorService.recordPayment), never one lump entry with no reference.
  // null only for the (rare) portion of a payment that exceeds every
  // outstanding order and is held as unallocated credit, and for Adjustment.
  @Prop({ default: null })
  @ApiProperty()
  referenceId: string;

  // Charge: the shop the sale happened at. Payment: the shop that received
  // the cash. Adjustment: null.
  @Prop({ default: null })
  @ApiProperty()
  shopId: string;

  @Prop({ type: ShopInfoSchema, default: null })
  @ApiProperty({ type: ShopInfo })
  shopInfoSnapshot: ShopInfo;

  // Payment only.
  @Prop({ enum: VendorPaymentMethod, default: null })
  @ApiProperty({ enum: VendorPaymentMethod })
  paymentMethod: VendorPaymentMethod;

  // Payment: a reference/receipt number. Adjustment: the reason.
  @Prop({ default: null })
  @ApiProperty()
  reference: string;

  @Prop({ default: null })
  @ApiProperty()
  description: string;

  // null for entries the system posts on its own (e.g. a charge from a
  // checkout sale).
  @Prop({ default: null })
  @ApiProperty()
  recordedById: string;
}
