import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { SupplierStatus } from 'src/enums';

@Schema()
export class Supplier extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  name: string;

  @Prop({ default: null })
  @ApiProperty()
  contactName: string;

  @Prop({ required: true })
  @ApiProperty()
  phone: string;

  @Prop({ default: null })
  @ApiProperty()
  email: string;

  @Prop({ default: null })
  @ApiProperty()
  location: string;

  // Free text - e.g. "Fresh vegetables" or "Poultry feed and supplements".
  @Prop({ default: null })
  @ApiProperty()
  supplies: string;

  @Prop({ type: String, enum: SupplierStatus, default: SupplierStatus.Active })
  @ApiProperty({ enum: SupplierStatus })
  status: SupplierStatus;
}
