import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ServiceStatus, Unit } from 'src/enums';
import { ServiceSpecialFeeRequest } from './service-special-fee.request.dto';

export class ServiceRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: Unit })
  @IsEnum(Unit)
  unit: Unit;

  // How much of `unit` the base `price` is for (e.g. 50, with unit Kg, for
  // a 50kg bag) - see Service's own comment.
  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitValue: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ type: [ServiceSpecialFeeRequest], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceSpecialFeeRequest)
  specialFees?: ServiceSpecialFeeRequest[];

  @ApiProperty({ enum: ServiceStatus, required: false })
  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;
}
