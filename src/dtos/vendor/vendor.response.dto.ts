import { ApiProperty } from '@nestjs/swagger';
import { Vendor } from 'src/schemas/vendor.schema';

export class VendorAging {
  @ApiProperty()
  current: number;

  @ApiProperty()
  days1to30: number;

  @ApiProperty()
  days31to60: number;

  @ApiProperty()
  daysOver60: number;
}

// Balance/overdue/overpayment/aging are all computed by VendorService from
// the vendor's ledger, never stored - the same "compute, never cache"
// approach as a shop's wallet balance.
export class VendorResponse extends Vendor {
  // How much the vendor owes - 0 if they're settled up or in credit.
  @ApiProperty()
  balance: number;

  @ApiProperty()
  overdue: number;

  // How much credit the vendor has with us (they've paid more than they
  // owe) - 0 unless that's actually the case. Never both this and
  // `balance` positive at once.
  @ApiProperty()
  overpayment: number;

  @ApiProperty({ type: VendorAging })
  aging: VendorAging;
}
