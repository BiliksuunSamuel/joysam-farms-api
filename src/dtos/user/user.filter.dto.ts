import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { UserStatus } from 'src/enums';

export class UserFilter extends BaseFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({ required: false, enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
