import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ShopInventoryStatus } from 'src/enums';

export class ShopInventoryStatusRequest {
  @ApiProperty({ enum: ShopInventoryStatus })
  @IsNotEmpty()
  @IsEnum(ShopInventoryStatus)
  status: ShopInventoryStatus;
}
