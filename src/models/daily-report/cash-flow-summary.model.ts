import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ _id: false })
export class CashFlowSummary {
  @Prop({ required: true })
  @ApiProperty()
  openingBalance: number;

  @Prop({ required: true })
  @ApiProperty()
  closingBalance: number;

  @Prop({ required: true })
  @ApiProperty()
  totalInflow: number;

  @Prop({ required: true })
  @ApiProperty()
  totalOutflow: number;
}
