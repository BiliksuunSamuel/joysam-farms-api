import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { ServiceStatus, Unit } from 'src/enums';
import { ServiceSpecialFee } from 'src/models/service/service-special-fee.model';

const ServiceSpecialFeeSchema = SchemaFactory.createForClass(ServiceSpecialFee);

// A company-wide offering that isn't a physical product (e.g. Grinding,
// Mixing) - sold through Sale.serviceItems, never mixed with Sale.items in
// the same transaction (see SaleService.create).
@Schema()
export class Service extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  name: string;

  @Prop({ default: null })
  @ApiProperty()
  description: string;

  // `price` is for one `unitValue` `unit` of whatever's being serviced
  // (e.g. 50 Kg - a full bag of maize) - see ServiceSpecialFee for priced
  // fractions of it (e.g. a Half or Quarter bag), which aren't simply
  // price/2 or price/4.
  @Prop({ type: String, enum: Unit, required: true })
  @ApiProperty({ enum: Unit })
  unit: Unit;

  @Prop({ required: true })
  @ApiProperty()
  unitValue: number;

  @Prop({ required: true })
  @ApiProperty()
  price: number;

  // Fixed fees for common fractions of unitValue (e.g. Half, Quarter) - a
  // cashier picks one of these labels instead of price, so nothing needs
  // calculating at checkout. Empty for a service always sold whole.
  @Prop({ type: [ServiceSpecialFeeSchema], default: [] })
  @ApiProperty({ type: [ServiceSpecialFee] })
  specialFees: ServiceSpecialFee[];

  @Prop({ type: String, enum: ServiceStatus, default: ServiceStatus.Active })
  @ApiProperty({ enum: ServiceStatus })
  status: ServiceStatus;
}
