import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { InstalmentFrequency } from 'src/enums';

// A payment plan an admin defines and a cashier picks at checkout. A sale
// keeps its own copy of the terms (Sale.instalment), so editing or removing
// a plan never changes a sale already in progress.
@Schema()
export class InstalmentPlan extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  name: string;

  // How many instalments the balance (after the deposit) is split into.
  @Prop({ required: true })
  @ApiProperty()
  instalmentCount: number;

  @Prop({ type: String, enum: InstalmentFrequency, required: true })
  @ApiProperty({ enum: InstalmentFrequency })
  frequency: InstalmentFrequency;

  // Share of the total due at checkout (0 = none).
  @Prop({ default: 0 })
  @ApiProperty()
  depositPercent: number;

  // Flat fee added to the sale total for the convenience of paying over time.
  @Prop({ default: 0 })
  @ApiProperty()
  feePercent: number;

  // Share of what the buyer has paid that is kept if the plan is cancelled;
  // the rest is refunded.
  @Prop({ default: 0 })
  @ApiProperty()
  cancellationFeePercent: number;

  @Prop({ default: true })
  @ApiProperty()
  active: boolean;
}
