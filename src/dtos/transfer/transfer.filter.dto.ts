import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { TransferStatus } from 'src/enums';

export class TransferFilter extends BaseFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fromShopId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  toShopId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  inventoryId?: string;

  @ApiProperty({ enum: TransferStatus, required: false })
  @IsOptional()
  @IsEnum(TransferStatus)
  status?: TransferStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  initiatedById?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  approvedById?: string;
}
