import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { InventoryStatus, Unit } from 'src/enums';

@Schema()
export class Inventory extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  name: string;

  @Prop({ default: null })
  @ApiProperty()
  description: string;

  @Prop({ required: true })
  @ApiProperty()
  categoryId: string;

  @Prop({ type: String, enum: Unit, default: null })
  @ApiProperty({ enum: Unit })
  unit: Unit;

  @Prop({ default: 0 })
  @ApiProperty()
  price: number;

  @Prop({ default: 0 })
  @ApiProperty()
  costPrice: number;

  @Prop({ default: 0 })
  @ApiProperty()
  quantity: number;

  @Prop({ default: 0 })
  @ApiProperty()
  reorderLevel: number;

  @Prop({ required: true, unique: true })
  @ApiProperty()
  serialNumber: string;

  @Prop({ required: true, unique: true })
  @ApiProperty()
  barcode: string;

  @Prop({
    type: String,
    enum: InventoryStatus,
    default: InventoryStatus.Available,
  })
  @ApiProperty({ enum: InventoryStatus })
  status: InventoryStatus;
}
