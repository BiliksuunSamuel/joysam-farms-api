import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { LedgerEntryType, LedgerSource } from 'src/enums';

// A single journal entry against a shop's wallet. Entries are append-only -
// a correction is a new, opposite entry, never an edit of an old one.
@Schema()
export class LedgerEntry extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  walletId: string;

  // Denormalised from the wallet, so the ledger can be queried by shop
  // directly without a join.
  @Prop({ required: true })
  @ApiProperty()
  shopId: string;

  @Prop({ enum: LedgerEntryType, required: true })
  @ApiProperty({ enum: LedgerEntryType })
  type: LedgerEntryType;

  @Prop({ enum: LedgerSource, required: true })
  @ApiProperty({ enum: LedgerSource })
  source: LedgerSource;

  // e.g. the Expense (or, once it exists, Sale) id that caused this entry.
  @Prop({ default: null })
  @ApiProperty()
  referenceId: string;

  // Always positive - direction comes from `type`.
  @Prop({ required: true })
  @ApiProperty()
  amount: number;

  // The wallet's balance immediately after this entry, for audit purposes.
  @Prop({ required: true })
  @ApiProperty()
  balanceAfter: number;

  @Prop({ default: null })
  @ApiProperty()
  description: string;

  // null for entries the system posts on its own (e.g. from an expense).
  @Prop({ default: null })
  @ApiProperty()
  recordedById: string;
}
