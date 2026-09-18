import { ApiProperty } from '@nestjs/swagger';
import { Wallet } from 'src/schemas/wallet.schema';

// Inherits every Wallet field, plus the balance - computed at read time by
// summing the ledger, never stored (see Wallet's own comment for why).
export class WalletResponse extends Wallet {
  @ApiProperty()
  balance: number;
}
