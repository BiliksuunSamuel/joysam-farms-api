import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { VendorStatus } from 'src/enums';

// A buyer (a restaurant, chop bar, hotel, school kitchen, etc.) who buys
// from JoySam Farms on credit - the opposite relationship from a Supplier,
// who JoySam Farms buys from to restock the warehouse. Balance/overdue/aging
// are never stored here - they're always computed from VendorLedgerEntry,
// the same "never cache it" philosophy as a shop's Wallet balance.
//
// There's no credit limit: this isn't a borrowing platform with a
// pre-approved spending ceiling, just a running account of what a vendor
// currently owes (or doesn't) - `status` (OnHold) is the only lever to stop
// further credit sales to a given vendor.
@Schema()
export class Vendor extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  name: string;

  @Prop({ required: true })
  @ApiProperty()
  contactName: string;

  @Prop({ default: null })
  @ApiProperty()
  phone: string;

  @Prop({ required: true })
  @ApiProperty()
  location: string;

  // Payment terms, in days - how long after a credit sale it's due. Used to
  // compute each charge's dueDate at the time it's posted.
  @Prop({ default: 30 })
  @ApiProperty()
  termsDays: number;

  // A deliberate freeze on new credit sales - distinct from "overdue", which
  // is always computed from the ledger, never stored.
  @Prop({ type: String, enum: VendorStatus, default: VendorStatus.Active })
  @ApiProperty({ enum: VendorStatus })
  status: VendorStatus;
}
