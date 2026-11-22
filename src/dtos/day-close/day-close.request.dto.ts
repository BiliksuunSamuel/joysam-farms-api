import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class DayCloseRequest {
  @ApiProperty({ required: false, description: 'Omit for a shop-tied cashier' })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({ required: false, description: 'YYYY-MM-DD, defaults to today' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  countedCash: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  countedMomo: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
