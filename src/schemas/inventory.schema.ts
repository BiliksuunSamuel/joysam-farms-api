import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { Unit } from 'src/enums';

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

  @Prop({ enum: Unit, default: null })
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
}
