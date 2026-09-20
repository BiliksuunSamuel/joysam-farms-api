import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Unit } from 'src/enums';

// A denormalised snapshot of an Inventory item, embedded on documents that
// reference one (alongside an inventoryId) so reads don't need a live
// lookup and history stays accurate even if the item's own record changes.
//
// @Schema() is required here even though this is never a top-level
// collection - NestJS's SchemaFactory.createForClass() only discovers
// @Prop() fields on classes decorated with @Schema(); without it the
// embedded sub-document silently saves as empty (just an auto _id).
// _id: false since this already has its own app-level `id`.
@Schema({ _id: false })
export class InventoryInfo {
  @Prop({ required: true })
  @ApiProperty()
  id: string;

  @Prop({ required: true })
  @ApiProperty()
  name: string;

  @Prop({ default: null })
  @ApiProperty()
  categoryId: string;

  @Prop({ default: null })
  @ApiProperty()
  description: string;

  @Prop({ type: String, enum: Unit, default: null })
  @ApiProperty({ enum: Unit })
  unit: Unit;

  @Prop({ default: 0 })
  @ApiProperty()
  price: number;

  @Prop({ default: null })
  @ApiProperty()
  serialNumber: string;

  @Prop({ default: null })
  @ApiProperty()
  barcode: string;
}
