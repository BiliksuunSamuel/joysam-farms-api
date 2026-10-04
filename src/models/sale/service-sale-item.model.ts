import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceInfo } from 'src/models/service/service-info.model';

const ServiceInfoSchema = SchemaFactory.createForClass(ServiceInfo);

// One line of a Sale: a quantity of one service, sold at its price at the
// time of sale (never trusted from the client - resolved server-side) -
// the service equivalent of SaleItem. A Sale has either `items` or
// `serviceItems`, never both - see SaleService.create.
//
// @Schema() is required even though this is never a top-level collection -
// see SaleItem's own comment for why.
@Schema({ _id: false })
export class ServiceSaleItem {
  @Prop({ required: true })
  @ApiProperty()
  serviceId: string;

  @Prop({ type: ServiceInfoSchema, default: null })
  @ApiProperty({ type: ServiceInfo })
  serviceInfoSnapshot: ServiceInfo;

  // null = the service's base price/unitValue was used. Otherwise, the
  // label of the ServiceSpecialFee this line was actually charged at (e.g.
  // "Half") - resolved and validated server-side against the service's own
  // specialFees at the time of sale, same trust model as unitPrice.
  @Prop({ type: String, default: null })
  @ApiProperty()
  feeLabel: string | null;

  @Prop({ required: true })
  @ApiProperty()
  quantity: number;

  @Prop({ required: true })
  @ApiProperty()
  unitPrice: number;

  @Prop({ required: true })
  @ApiProperty()
  lineTotal: number;
}
