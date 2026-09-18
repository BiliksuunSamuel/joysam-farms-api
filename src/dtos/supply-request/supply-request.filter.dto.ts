import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { SupplyRequestStatus } from 'src/enums';

export class SupplyRequestFilter extends BaseFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  inventoryId?: string;

  @ApiProperty({ enum: SupplyRequestStatus, required: false })
  @IsOptional()
  @IsEnum(SupplyRequestStatus)
  status?: SupplyRequestStatus;
}
