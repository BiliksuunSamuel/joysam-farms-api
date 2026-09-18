import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ExpenseCategory, ExpenseStatus, ExpenseTrendGroupBy } from 'src/enums';

/** Not paginated - stands alone rather than extending ExpenseFilter/BaseFilter, which require page/pageSize. */
export class ExpenseTrendFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({ enum: ExpenseCategory, required: false })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @ApiProperty({ enum: ExpenseStatus, required: false })
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @ApiProperty({ enum: ExpenseTrendGroupBy, required: false, default: ExpenseTrendGroupBy.Day })
  @IsOptional()
  @IsEnum(ExpenseTrendGroupBy)
  groupBy?: ExpenseTrendGroupBy;

  @ApiProperty({ required: false, description: 'start date for filter' })
  @IsOptional()
  startDate?: Date;

  @ApiProperty({ required: false, description: 'end date for filter' })
  @IsOptional()
  endDate?: Date;
}
