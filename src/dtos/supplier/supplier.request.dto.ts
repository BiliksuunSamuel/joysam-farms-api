import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { SupplierStatus } from 'src/enums';
import { IsValidPhoneNumber } from 'src/decorators/is-valid-phone-number.decorator';

export class SupplierRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsValidPhoneNumber()
  phone: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplies?: string;

  @ApiProperty({ enum: SupplierStatus, required: false })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;
}
