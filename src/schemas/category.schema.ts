import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { Unit } from 'src/enums';

@Schema()
export class Category extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  name: string;

  @Prop({ default: null })
  @ApiProperty()
  description: string;

  // Server-generated (8 digits), never client-supplied, stable for the
  // category's lifetime.
  @Prop({ required: true, unique: true })
  @ApiProperty()
  categoryCode: string;

  @Prop({ default: false })
  @ApiProperty()
  perishable: boolean;

  @Prop({ type: String, enum: Unit, default: null })
  @ApiProperty({ enum: Unit })
  defaultUnit: Unit;
}
