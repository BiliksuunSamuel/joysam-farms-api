import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentTransactionStatus } from 'src/enums';

@Schema({ _id: false })
export class PaymentStatusBreakdownItem {
  @Prop({ enum: PaymentTransactionStatus, required: true })
  @ApiProperty({ enum: PaymentTransactionStatus })
  status: PaymentTransactionStatus;

  @Prop({ required: true })
  @ApiProperty()
  count: number;

  @Prop({ required: true })
  @ApiProperty()
  amount: number;
}
