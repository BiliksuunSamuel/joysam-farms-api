import { ApiProperty } from '@nestjs/swagger';
import { UserRequest } from './user.request.dto';
import { IsNotEmpty } from 'class-validator';

export class CreateUserRequest extends UserRequest {
  @ApiProperty()
  @IsNotEmpty()
  password: string;
}
