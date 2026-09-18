import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { ShopInfo } from 'src/models/shop/shop-info.model';

const ShopInfoSchema = SchemaFactory.createForClass(ShopInfo);

// One per shop. No balance field here: the balance is always computed by
// summing the wallet's LedgerEntry rows, never cached, so it can never
// drift out of sync with the ledger that is its source of truth.
@Schema()
export class Wallet extends BaseSchema {
  @Prop({ required: true, unique: true })
  @ApiProperty()
  shopId: string;

  @Prop({ type: ShopInfoSchema, required: true })
  @ApiProperty({ type: ShopInfo })
  shopInfoSnapshot: ShopInfo;

  @Prop({ required: true, unique: true })
  @ApiProperty()
  accountNumber: string;
}
