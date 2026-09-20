import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

// Paystack's authorization object, captured verbatim at verify time. Used
// for both channels: for mobile_money, `bank` carries the network name
// (e.g. "MTN") and `mobileMoneyNumber` the buyer's own number - the actual
// detail entered on Paystack's checkout page, which this app never
// collects itself. Card fields are populated instead when channel="card".
//
// @Schema() is required even though this is never a top-level collection -
// SchemaFactory.createForClass() only discovers @Prop() fields on classes
// decorated with @Schema(); without it this embeds as empty.
@Schema({ _id: false })
export class PaymentAuthorization {
  @Prop({ default: null })
  @ApiProperty()
  authorizationCode: string;

  @Prop({ default: null })
  @ApiProperty()
  channel: string;

  // Card only.
  @Prop({ default: null })
  @ApiProperty()
  bin: string;

  @Prop({ default: null })
  @ApiProperty()
  last4: string;

  @Prop({ default: null })
  @ApiProperty()
  expMonth: string;

  @Prop({ default: null })
  @ApiProperty()
  expYear: string;

  @Prop({ default: null })
  @ApiProperty()
  cardType: string;

  @Prop({ default: null })
  @ApiProperty()
  brand: string;

  @Prop({ default: false })
  @ApiProperty()
  reusable: boolean;

  // Mobile money only - bank carries the network name (e.g. "MTN").
  @Prop({ default: null })
  @ApiProperty()
  bank: string;

  @Prop({ default: null })
  @ApiProperty()
  mobileMoneyNumber: string;

  @Prop({ default: null })
  @ApiProperty()
  accountName: string;

  @Prop({ default: null })
  @ApiProperty()
  countryCode: string;
}
