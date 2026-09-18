import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class ResetPasswordRequest {
  @ApiProperty()
  @IsNotEmpty()
  password: string;
}
