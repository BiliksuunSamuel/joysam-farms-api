import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

// One category's slice of a day's sales - categoryId is null when a sold
// item has no category assigned (see SalesTrendGroupBy.Category, which this
// mirrors).
@Schema({ _id: false })
export class SalesCategoryBreakdownItem {
  @Prop({ default: null })
  @ApiProperty()
  categoryId: string | null;

  @Prop({ required: true })
  @ApiProperty()
  categoryName: string;

  @Prop({ required: true })
  @ApiProperty()
  revenue: number;

  @Prop({ required: true })
  @ApiProperty()
  unitsSold: number;
}
