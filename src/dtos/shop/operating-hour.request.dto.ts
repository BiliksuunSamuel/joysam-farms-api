import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { WeekDay } from 'src/enums';

export class OperatingHourRequest {
  @ApiProperty({ required: false, description: 'Generated if omitted' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ enum: WeekDay })
  @IsEnum(WeekDay)
  day: WeekDay;

  @ApiProperty()
  @IsBoolean()
  isAvailable: boolean;

  @ApiProperty({ required: false, example: '08:00' })
  @IsOptional()
  @IsString()
  openingTime?: string;

  @ApiProperty({ required: false, example: '18:00' })
  @IsOptional()
  @IsString()
  closingTime?: string;
}
