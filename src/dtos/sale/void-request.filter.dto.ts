import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { VoidRequestStatus } from 'src/enums';

export class VoidRequestFilter extends BaseFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({ enum: VoidRequestStatus, required: false })
  @IsOptional()
  @IsEnum(VoidRequestStatus)
  status?: VoidRequestStatus;
}
