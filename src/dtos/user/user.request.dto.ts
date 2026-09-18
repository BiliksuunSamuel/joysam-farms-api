import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsValidPhoneNumber } from 'src/decorators/is-valid-phone-number.decorator';

export class UserRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsValidPhoneNumber()
  phone: string;

  // Falls back to the platform's default (full-access) role if omitted -
  // mainly so the very first user can be created before any other role
  // exists to assign.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  roleId?: string;

  // Not tied to a shop (e.g. a super manager at head office) if omitted.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  shopId?: string;
}
