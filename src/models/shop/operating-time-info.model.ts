import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

// Computed at read time from a shop's operating hours, never persisted.
export class OperatingTimeInfo {
  @Prop({ required: true })
  @ApiProperty()
  isOpen: boolean;

  @Prop({ required: true })
  @ApiProperty()
  message: string;
}
