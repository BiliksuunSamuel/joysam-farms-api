import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { SalePaymentMethod, SaleStatus } from 'src/enums';
import { CustomerInfo } from 'src/models/customer/customer-info.model';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { UserInfo } from 'src/models/user/user-info.model';
import { VendorInfo } from 'src/models/vendor/vendor-info.model';
import { SaleItem } from 'src/models/sale/sale-item.model';
import { PaymentSplit } from 'src/models/sale/payment-split.model';
import { VoidRequest } from 'src/models/sale/void-request.model';

const ShopInfoSchema = SchemaFactory.createForClass(ShopInfo);
const UserInfoSchema = SchemaFactory.createForClass(UserInfo);
const VendorInfoSchema = SchemaFactory.createForClass(VendorInfo);
const CustomerInfoSchema = SchemaFactory.createForClass(CustomerInfo);
const SaleItemSchema = SchemaFactory.createForClass(SaleItem);
const PaymentSplitSchema = SchemaFactory.createForClass(PaymentSplit);
const VoidRequestSchema = SchemaFactory.createForClass(VoidRequest);

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

  @Prop({ type: String, enum: SalePaymentMethod, required: true })
  @ApiProperty({ enum: SalePaymentMethod })
  paymentMethod: SalePaymentMethod;

  // Denormalized from paymentMethod === Split, so reporting can filter/index
  // on a plain boolean rather than a string comparison - see
  // SaleRepository.getSplitSalesTotals.
  @Prop({ default: false })
  @ApiProperty()
  isSplitSale: boolean;

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

  // Split only - exactly two legs (one Cash + one Digital, going forward -
  // older sales may have Cash + MobileMoney). Empty for every other
  // paymentMethod, whose detail lives in the flat fields above.
  @Prop({ type: [PaymentSplitSchema], default: [] })
  @ApiProperty({ type: [PaymentSplit] })
  payments: PaymentSplit[];

  @Prop({ type: String, enum: SaleStatus, default: SaleStatus.Completed })
  @ApiProperty({ enum: SaleStatus })
  status: SaleStatus;

  // Credit only - the vendor this sale was billed to.
  @Prop({ default: null })
  @ApiProperty()
  vendorId: string;

  @Prop({ type: VendorInfoSchema, default: null })
  @ApiProperty({ type: VendorInfo })
  vendorInfoSnapshot: VendorInfo;

  // Any payment method - the walk-in customer this sale was rung up for, if
  // their name/phone were captured at checkout. Found-or-created by phone -
  // see CustomerService.findOrCreateForSale.
  @Prop({ default: null })
  @ApiProperty()
  customerId: string;

  @Prop({ type: CustomerInfoSchema, default: null })
  @ApiProperty({ type: CustomerInfo })
  customerInfoSnapshot: CustomerInfo;

  // Any payment method - a free-text note about this specific sale (e.g.
  // "customer wants delivery", "gift wrapped").
  @Prop({ type: String, default: null })
  @ApiProperty()
  note: string | null;

  // A manual void request on this (Completed) sale, if one has ever been
  // made - see VoidRequest and SaleService.requestVoid/approveVoid/
  // rejectVoid. Never set by the auto-void path for an abandoned Digital
  // payment (SaleRepository.finalize, Pending -> Voided) - that only ever
  // touches Pending sales, this only ever touches Completed ones.
  @Prop({ type: VoidRequestSchema, default: null })
  @ApiProperty({ type: VoidRequest })
  voidRequest: VoidRequest | null;
}
