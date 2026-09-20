import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { SupplyRequestStatus } from 'src/enums';
import { SupplierInfo } from 'src/models/supplier/supplier-info.model';
import { SupplyRequestItem } from 'src/models/supply-request/supply-request-item.model';

const SupplierInfoSchema = SchemaFactory.createForClass(SupplierInfo);
const SupplyRequestItemSchema = SchemaFactory.createForClass(SupplyRequestItem);

// An order for one or more items from an external supplier, to restock the
// warehouse. Approving one immediately increases each line's warehouse
// quantity by its full requested amount - there's no partial fulfilment or
// separate "goods received" step; the delivery is assumed to have arrived
// as ordered.
@Schema()
export class SupplyRequest extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  supplierId: string;

  @Prop({ type: SupplierInfoSchema, required: true })
  @ApiProperty({ type: SupplierInfo })
  supplierInfoSnapshot: SupplierInfo;

  @Prop({ type: [SupplyRequestItemSchema], default: [] })
  @ApiProperty({ type: [SupplyRequestItem] })
  items: SupplyRequestItem[];

  @Prop({
    type: String,
    enum: SupplyRequestStatus,
    default: SupplyRequestStatus.Pending,
  })
  @ApiProperty({ enum: SupplyRequestStatus })
  status: SupplyRequestStatus;

  @Prop({ required: true })
  @ApiProperty()
  requestedById: string;

  @Prop({ default: null })
  @ApiProperty()
  reviewedById: string;

  @Prop({ default: null })
  @ApiProperty()
  notes: string;
}
