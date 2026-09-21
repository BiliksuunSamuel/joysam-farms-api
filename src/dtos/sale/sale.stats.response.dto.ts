import { ApiProperty } from '@nestjs/swagger';

// Scoped by the same filters as SaleFilter (shop/cashier/customer/payment
// method/date range) but not by status - Completed and Voided are both
// always broken out here, the same convention the checkout page's own
// today-only KPI cards already use.
export class SaleStatsResponse {
  @ApiProperty()
  revenue: number;

  @ApiProperty()
  transactionCount: number;

  @ApiProperty()
  averageSale: number;

  @ApiProperty()
  voidedCount: number;

  @ApiProperty()
  itemsSold: number;
}
