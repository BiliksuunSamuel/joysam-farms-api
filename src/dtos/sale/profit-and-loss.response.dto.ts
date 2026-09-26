import { ApiProperty } from '@nestjs/swagger';

// Gross profit only - revenue minus cost of goods sold from Sales data
// alone, not a full P&L (no operating expenses netted in yet).
export class ProfitAndLossResponse {
  @ApiProperty()
  revenue: number;

  @ApiProperty()
  cost: number;

  @ApiProperty()
  profit: number;

  // 0 when revenue is 0, rather than NaN/Infinity.
  @ApiProperty()
  marginPercent: number;
}
