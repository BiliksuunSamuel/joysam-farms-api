import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Unit } from 'src/enums';

// No categoryCode here - it's generated server-side, never client-supplied.
export class CategoryRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  perishable?: boolean;

  @ApiProperty({ enum: Unit, required: false })
  @IsOptional()
  @IsEnum(Unit)
  defaultUnit?: Unit;
}
