import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { ExpenseCategoryBreakdownItem } from './expense-category-breakdown-item.model';

const ExpenseCategoryBreakdownItemSchema = SchemaFactory.createForClass(
  ExpenseCategoryBreakdownItem,
);

@Schema({ _id: false })
export class ExpenseSummary {
  @Prop({ required: true })
  @ApiProperty()
  total: number;

  @Prop({ type: [ExpenseCategoryBreakdownItemSchema], default: [] })
  @ApiProperty({ type: [ExpenseCategoryBreakdownItem] })
  categoryBreakdown: ExpenseCategoryBreakdownItem[];
}
