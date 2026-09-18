import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { ShopInventoryStatus } from 'src/enums';

export class ShopInventoryFilter extends BaseFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  inventoryId?: string;

  @ApiProperty({ enum: ShopInventoryStatus, required: false })
  @IsOptional()
  @IsEnum(ShopInventoryStatus)
  status?: ShopInventoryStatus;
}
