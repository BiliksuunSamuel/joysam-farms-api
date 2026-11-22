import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { UserInfo } from 'src/models/user/user-info.model';

const ShopInfoSchema = SchemaFactory.createForClass(ShopInfo);
const UserInfoSchema = SchemaFactory.createForClass(UserInfo);

// What the system expected to find at the end of one cashier's day at one
// shop - worked out from their own sales, debt collections and instalment
// payments, never trusted from the client.
export interface DayCloseFigures {
  // Takings that came from selling goods and services.
  salesCash: number;
  salesMomo: number; // manual mobile money, paid to the business number
  salesDigital: number; // Paystack - not in the till or on the phone
  salesCredit: number; // billed to a vendor, no money changed hands
  salesCount: number;
  // Money that is not a sale: vendors paying down what they owe.
  debtsCash: number;
  debtsMomo: number;
  debtCount: number;
  // Instalment deposits and payments.
  instalmentsCash: number;
  instalmentsMomo: number;
  instalmentCount: number;
  voidedCount: number;
  voidedTotal: number;
  // Cash paid back out for instalment plans this cashier cancelled. Closes
  // saved before refunds were tracked have neither field.
  refundsCash?: number;
  refundsMomo?: number;
  refundCount?: number;
  // What should be in the drawer / on the business mobile money account.
  expectedCash: number;
  expectedMomo: number;
}

// One cashier's closed day at a shop. Closing again the same day replaces the
// record (and bumps `revision`) - a miscount is fixed by counting again.
@Schema()
export class DayClose extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  shopId: string;

  @Prop({ type: ShopInfoSchema, default: null })
  @ApiProperty({ type: ShopInfo })
  shopInfoSnapshot: ShopInfo;

  @Prop({ required: true })
  @ApiProperty()
  cashierId: string;

  @Prop({ type: UserInfoSchema, default: null })
  @ApiProperty({ type: UserInfo })
  cashierInfoSnapshot: UserInfo;

  // The business day being closed, "YYYY-MM-DD" (Ghana is UTC all year).
  @Prop({ required: true })
  @ApiProperty()
  date: string;

  @Prop({ type: Object, required: true })
  @ApiProperty()
  figures: DayCloseFigures;

  @Prop({ required: true })
  @ApiProperty()
  countedCash: number;

  @Prop({ required: true })
  @ApiProperty()
  countedMomo: number;

  // counted - expected: negative is short, positive is over.
  @Prop({ default: 0 })
  @ApiProperty()
  cashDifference: number;

  @Prop({ default: 0 })
  @ApiProperty()
  momoDifference: number;

  // Required whenever either difference is not zero.
  @Prop({ type: String, default: null })
  @ApiProperty()
  reason: string | null;

  @Prop({ type: String, default: null })
  @ApiProperty()
  note: string | null;

  @Prop({ default: 1 })
  @ApiProperty()
  revision: number;
}
