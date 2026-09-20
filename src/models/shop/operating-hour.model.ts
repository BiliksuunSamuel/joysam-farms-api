import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { WeekDay } from 'src/enums';

// @Schema() is required here even though this is never a top-level
// collection - NestJS's SchemaFactory.createForClass() only discovers
// @Prop() fields on classes decorated with @Schema(); without it the
// embedded sub-document silently saves as empty (just an auto _id).
// _id: false since this already has its own app-level `id`.
@Schema({ _id: false })
export class OperatingHour {
  @Prop({ required: true })
  @ApiProperty()
  id: string;

  @Prop({ type: String, required: true, enum: WeekDay })
  @ApiProperty({ enum: WeekDay })
  day: WeekDay;

  @Prop({ required: true, default: true })
  @ApiProperty()
  isAvailable: boolean;

  @Prop({ default: null })
  @ApiProperty()
  openingTime: string;

  @Prop({ default: null })
  @ApiProperty()
  closingTime: string;
}
