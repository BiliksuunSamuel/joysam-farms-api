import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { ExpenseCategory } from 'src/enums';

@Schema({ _id: false })
export class ExpenseCategoryBreakdownItem {
  @Prop({ type: String, enum: ExpenseCategory, required: true })
  @ApiProperty({ enum: ExpenseCategory })
  category: ExpenseCategory;

  @Prop({ required: true })
  @ApiProperty()
  amount: number;

  @Prop({ required: true })
  @ApiProperty()
  count: number;
}
