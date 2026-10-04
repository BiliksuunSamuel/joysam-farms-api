import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

// A fixed, named fee override for a fraction of a Service's base
// unit/unitValue (e.g. "Half" of a 50kg bag of maize for Grinding) - set up
// once by an admin so a cashier just picks the matching label at checkout
// instead of calculating a proportional price (see SaleService's
// resolveServiceSaleItems).
@Schema({ _id: false })
export class ServiceSpecialFee {
  @Prop({ required: true })
  @ApiProperty()
  label: string;

  @Prop({ required: true })
  @ApiProperty()
  fee: number;
}
