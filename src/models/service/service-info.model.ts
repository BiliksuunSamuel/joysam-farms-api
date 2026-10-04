import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Unit } from 'src/enums';

// A denormalised snapshot of a Service, embedded on a ServiceSaleItem
// (alongside a serviceId) so a receipt's price/name stays accurate even if
// the service's own record changes afterward - same reasoning as
// InventoryInfo on SaleItem. Doesn't include specialFees - which fee tier
// (if any) a sale line actually used is captured on ServiceSaleItem
// itself (feeLabel/unitPrice), not the whole menu of options.
//
// @Schema() is required here even though this is never a top-level
// collection - see InventoryInfo's own comment for why.
@Schema({ _id: false })
export class ServiceInfo {
  @Prop({ required: true })
  @ApiProperty()
  id: string;

  @Prop({ required: true })
  @ApiProperty()
  name: string;

  @Prop({ default: null })
  @ApiProperty()
  description: string;

  @Prop({ type: String, enum: Unit, default: null })
  @ApiProperty({ enum: Unit })
  unit: Unit;

  @Prop({ default: 0 })
  @ApiProperty()
  unitValue: number;

  @Prop({ default: 0 })
  @ApiProperty()
  price: number;
}
