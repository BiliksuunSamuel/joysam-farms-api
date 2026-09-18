import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserPermissionsRequest {
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  allPermissions?: boolean;
}
