import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { SalePaymentMethod, SaleStatus } from 'src/enums';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { UserInfo } from 'src/models/user/user-info.model';
import { VendorInfo } from 'src/models/vendor/vendor-info.model';
import { SaleItem } from 'src/models/sale/sale-item.model';
import { PaymentSplit } from 'src/models/sale/payment-split.model';

const ShopInfoSchema = SchemaFactory.createForClass(ShopInfo);
const UserInfoSchema = SchemaFactory.createForClass(UserInfo);
const VendorInfoSchema = SchemaFactory.createForClass(VendorInfo);
const SaleItemSchema = SchemaFactory.createForClass(SaleItem);
const PaymentSplitSchema = SchemaFactory.createForClass(PaymentSplit);

// A completed till sale at a shop - always atomic: the moment it's created,
// stock is deducted and revenue is posted to the shop's ledger. There's no
// pending state (unlike Transfer) since checkout only ever rings up what
// already left the shop.
@Schema()
export class Sale extends BaseSchema {
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

  @Prop({ required: true, unique: true })
  @ApiProperty()
  receiptNo: string;

  @Prop({ type: [SaleItemSchema], default: [] })
  @ApiProperty({ type: [SaleItem] })
  items: SaleItem[];

  @Prop({ required: true })
  @ApiProperty()
  subtotal: number;

  @Prop({ default: 0 })
  @ApiProperty()
  discount: number;

  @Prop({ required: true })
  @ApiProperty()
  total: number;

  @Prop({ enum: SalePaymentMethod, required: true })
  @ApiProperty({ enum: SalePaymentMethod })
  paymentMethod: SalePaymentMethod;

  // Cash only - how much the buyer handed over and their change.
  @Prop({ default: null })
  @ApiProperty()
  amountTendered: number;

  @Prop({ default: null })
  @ApiProperty()
  changeGiven: number;

  // MobileMoney only.
  @Prop({ default: null })
  @ApiProperty()
  momoNetwork: string;

  @Prop({ default: null })
  @ApiProperty()
  momoPhone: string;

  // Split only - exactly two legs (one Cash + one MobileMoney). Empty for
  // every other paymentMethod, whose detail lives in the flat fields above.
  @Prop({ type: [PaymentSplitSchema], default: [] })
  @ApiProperty({ type: [PaymentSplit] })
  payments: PaymentSplit[];

  @Prop({ enum: SaleStatus, default: SaleStatus.Completed })
  @ApiProperty({ enum: SaleStatus })
  status: SaleStatus;

  // Credit only - the vendor this sale was billed to.
  @Prop({ default: null })
  @ApiProperty()
  vendorId: string;

  @Prop({ type: VendorInfoSchema, default: null })
  @ApiProperty({ type: VendorInfo })
  vendorInfoSnapshot: VendorInfo;
}
