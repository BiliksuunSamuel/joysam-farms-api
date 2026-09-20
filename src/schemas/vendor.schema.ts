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
// Beyond `status` (OnHold, a deliberate manual freeze), each vendor also
// carries its own credit policy below - see VendorService.assertCanSellOnCredit
// for how these are evaluated. This used to be one platform-wide policy
// (Settings.blockCreditSalesWhenOverdue/overdueGraceDays) - moved here so a
// reliable, high-volume vendor and a new, unproven one can be governed
// differently instead of one rule fitting everyone.
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

  // ---- Credit policy ----
  // Every rule below is independently optional (off/unset = no restriction
  // from it) and all configured rules must pass for a credit sale to go
  // through - see VendorService.assertCanSellOnCredit.

  // Blocks a new credit sale the moment this vendor has ANY unpaid charge,
  // even one that isn't due yet - the strictest of the rules below.
  @Prop({ default: false })
  @ApiProperty()
  blockCreditIfAnyOutstanding: boolean;

  // Blocks a new credit sale once this vendor has an unpaid charge past its
  // due date (+ the grace period below).
  @Prop({ default: false })
  @ApiProperty()
  blockCreditIfOverdue: boolean;

  // Days after a charge's due date before it counts as overdue for
  // blockCreditIfOverdue - irrelevant while that's off.
  @Prop({ default: 0 })
  @ApiProperty()
  creditOverdueGraceDays: number;

  // Blocks a new credit sale once this vendor's total outstanding balance
  // would be at or above this amount. null = no cap.
  @Prop({ type: Number, default: null })
  @ApiProperty()
  maxOutstandingCreditBalance: number | null;

  // Blocks a new credit sale once this vendor already has this many unpaid
  // charges open at once (regardless of amount). null = no cap.
  @Prop({ type: Number, default: null })
  @ApiProperty()
  maxOpenCreditSales: number | null;
}
