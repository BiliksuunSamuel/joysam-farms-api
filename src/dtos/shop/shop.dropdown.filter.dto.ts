import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { DropdownFilter } from 'src/dtos/common/dropdown.filter.dto';
import { ShopStatus } from 'src/enums';

export class ShopDropdownFilter extends DropdownFilter {
  @ApiProperty({ required: false, enum: ShopStatus })
  @IsOptional()
  @IsEnum(ShopStatus)
  status?: ShopStatus;
}
