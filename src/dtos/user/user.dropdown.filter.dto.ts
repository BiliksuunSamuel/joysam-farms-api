import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DropdownFilter } from 'src/dtos/common/dropdown.filter.dto';
import { UserStatus } from 'src/enums';

export class UserDropdownFilter extends DropdownFilter {
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
