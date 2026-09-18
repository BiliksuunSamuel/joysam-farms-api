import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { SupplyRequestItemRequest } from './supply-request.item.request.dto';

export class SupplyRequestRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  supplierId: string;

  @ApiProperty({ type: [SupplyRequestItemRequest] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SupplyRequestItemRequest)
  items: SupplyRequestItemRequest[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
