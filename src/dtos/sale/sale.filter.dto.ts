import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { SalePaymentMethod, SaleStatus } from 'src/enums';

export class SaleFilter extends BaseFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cashierId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ enum: SalePaymentMethod, required: false })
  @IsOptional()
  @IsEnum(SalePaymentMethod)
  paymentMethod?: SalePaymentMethod;

  @ApiProperty({ enum: SaleStatus, required: false })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;
}
