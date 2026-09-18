import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserStatus } from 'src/enums';

export class UpdateUserStatusRequest {
  @ApiProperty({ enum: UserStatus })
  @IsNotEmpty()
  @IsEnum(UserStatus)
  status: UserStatus;
}
