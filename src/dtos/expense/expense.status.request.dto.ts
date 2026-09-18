import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ExpenseStatus } from 'src/enums';

export class ExpenseStatusRequest {
  @ApiProperty({ enum: ExpenseStatus })
  @IsNotEmpty()
  @IsEnum(ExpenseStatus)
  status: ExpenseStatus;
}
