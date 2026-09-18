import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { ExpenseCategory, ExpenseStatus } from 'src/enums';

export class ExpenseFilter extends BaseFilter {
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
}
