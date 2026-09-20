import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { PaymentTransactionStatus } from 'src/enums';
import { PaymentAuthorization } from 'src/models/payment/payment-authorization.model';

const PaymentAuthorizationSchema =
  SchemaFactory.createForClass(PaymentAuthorization);

// One row per Paystack transaction attempt, linked 1:1 to the Sale it's
// paying for. The Sale itself (not this record) is the source of truth for
// whether the sale is Pending/Completed/Voided - see
// PaymentTransactionService.confirmDigitalPayment, which guards the
// one-time side effects (stock restore, ledger credit) on Sale.status via
// an atomic compare-and-swap, and treats this record's status as a
// denormalized mirror that's safe to overwrite repeatedly.
@Schema()
export class PaymentTransaction extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  saleId: string;

  @Prop({ required: true, unique: true })
  @ApiProperty()
  reference: string;

  @Prop({ required: true })
  @ApiProperty()
  shopId: string;

  // GHS - conversion to the smallest currency unit (pesewas) happens only
  // at the PaystackService API boundary, never stored here.
  @Prop({ required: true })
  @ApiProperty()
  amount: number;

  // What was actually sent to Paystack, for audit - see
  // SaleService.create's Digital branch for how this is chosen.
  @Prop({ required: true })
  @ApiProperty()
  email: string;

  @Prop({
    type: String,
    enum: PaymentTransactionStatus,
    default: PaymentTransactionStatus.Pending,
  })
  @ApiProperty({ enum: PaymentTransactionStatus })
  status: PaymentTransactionStatus;

  @Prop({ default: null })
  @ApiProperty()
  authorizationUrl: string;

  // "mobile_money" | "card" - filled in once Paystack reports it back.
  @Prop({ default: null })
  @ApiProperty()
  channel: string;

  @Prop({ default: null })
  @ApiProperty()
  paidAt: Date;

  @Prop({ default: null })
  @ApiProperty()
  gatewayResponse: string;

  @Prop({ default: null })
  @ApiProperty()
  failureReason: string;

  // Everything below is only known once Paystack actually verifies the
  // transaction (see PaymentTransactionService.completeSale/voidPendingSale)
  // - none of it exists yet right after initiateForSale.

  // Paystack's own transaction id - lets a transaction be looked up
  // directly via PaystackService.getTransaction, not just by our reference.
  @Prop({ default: null })
  @ApiProperty()
  paystackTransactionId: number;

  @Prop({ default: null })
  @ApiProperty()
  currency: string;

  @Prop({ default: null })
  @ApiProperty()
  fees: number;

  @Prop({ default: null })
  @ApiProperty()
  ipAddress: string;

  @Prop({ default: null })
  @ApiProperty()
  customerCode: string;

  @Prop({ type: PaymentAuthorizationSchema, default: null })
  @ApiProperty({ type: PaymentAuthorization })
  authorization: PaymentAuthorization;

  // How many times the buyer attempted this payment on Paystack's own
  // checkout page before it resolved - useful context without needing to
  // ask the cashier what happened.
  @Prop({ default: null })
  @ApiProperty()
  attempts: number;
}
