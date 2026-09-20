import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

// unitsSold is copied from SalesSummary.unitsSold at generation time, not an
// independent aggregation - kept here too since "units sold" reads more
// naturally as inventory movement than as a sales metric.
@Schema({ _id: false })
export class InventoryMovement {
  @Prop({ required: true })
  @ApiProperty()
  unitsSold: number;

  @Prop({ required: true })
  @ApiProperty()
  stockRequestsCreated: number;

  @Prop({ required: true })
  @ApiProperty()
  transfersCompleted: number;
}
