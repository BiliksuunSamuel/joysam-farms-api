import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  ExpenseCategory,
  ExpensePaymentMethod,
  ExpenseStatus,
} from 'src/enums';

export class ExpenseRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ enum: ExpenseCategory })
  @IsNotEmpty()
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  // Omit for a company-wide / head office expense.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  payee: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: ExpensePaymentMethod })
  @IsNotEmpty()
  @IsEnum(ExpensePaymentMethod)
  paymentMethod: ExpensePaymentMethod;

  @ApiProperty({ enum: ExpenseStatus, required: false })
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;
}
