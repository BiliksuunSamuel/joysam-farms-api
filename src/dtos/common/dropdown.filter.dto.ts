import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// Base filter for dropdown endpoints - no pagination, just an optional
// search term. Each resource extends this with whatever filters actually
// make sense for it (status, roleId, etc).
export class DropdownFilter {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  query?: string;
}
