import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { StockRequestStatus } from 'src/enums';

export class StockRequestFilter extends BaseFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  inventoryId?: string;

  @ApiProperty({ enum: StockRequestStatus, required: false })
  @IsOptional()
  @IsEnum(StockRequestStatus)
  status?: StockRequestStatus;
}
