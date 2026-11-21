import { ApiProperty } from '@nestjs/swagger';
import { Customer } from 'src/schemas/customer.schema';

// Every Customer field plus what they have bought, computed from Completed
// sales at read time (never stored). Only the list endpoint fills these in;
// a customer fetched by id comes back without them.
export class CustomerResponse extends Customer {
  @ApiProperty({ required: false })
  salesCount?: number;

  @ApiProperty({ required: false })
  totalSpent?: number;

  @ApiProperty({ required: false, nullable: true })
  lastPurchaseAt?: Date | null;
}
