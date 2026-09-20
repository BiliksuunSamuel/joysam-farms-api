import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { SalePaymentMethod } from 'src/enums';

// One leg of a split sale - always Cash or MobileMoney (Credit is never
// split, see SaleService.create).
//
// @Schema() is required even though this is never a top-level collection -
// SchemaFactory.createForClass() only discovers @Prop() fields on classes
// decorated with @Schema(); without it this embeds as empty.
@Schema({ _id: false })
export class PaymentSplit {
  @Prop({ enum: SalePaymentMethod, required: true })
  @ApiProperty({ enum: SalePaymentMethod })
  method: SalePaymentMethod;

  @Prop({ required: true })
  @ApiProperty()
  amount: number;

  // Cash leg only.
  @Prop({ default: null })
  @ApiProperty()
  amountTendered: number;

  @Prop({ default: null })
  @ApiProperty()
  changeGiven: number;

  // MobileMoney leg only.
  @Prop({ default: null })
  @ApiProperty()
  momoNetwork: string;

  @Prop({ default: null })
  @ApiProperty()
  momoPhone: string;
}
