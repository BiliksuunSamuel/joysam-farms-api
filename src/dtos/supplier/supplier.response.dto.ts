import { ApiProperty } from '@nestjs/swagger';
import { Supplier } from 'src/schemas/supplier.schema';

// Balance/overpayment are computed by SupplierService from the supplier's
// ledger, never stored - the same "compute, never cache" approach as a
// shop's wallet balance and VendorResponse's own balance/overdue/aging.
export class SupplierResponse extends Supplier {
  // How much we owe the supplier - 0 if we're settled up or in credit.
  @ApiProperty()
  balance: number;

  // How much credit we have with the supplier (we've paid more than we
  // owe) - 0 unless that's actually the case. Never both this and
  // `balance` positive at once.
  @ApiProperty()
  overpayment: number;
}
