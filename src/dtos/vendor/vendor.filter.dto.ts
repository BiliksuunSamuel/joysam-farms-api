import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { VendorStatus } from 'src/enums';

export class VendorFilter extends BaseFilter {
  @ApiProperty({ enum: VendorStatus, required: false })
  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;
}
