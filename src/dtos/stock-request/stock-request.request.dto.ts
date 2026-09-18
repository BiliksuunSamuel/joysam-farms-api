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
import { StockRequestItemRequest } from './stock-request.item.request.dto';

export class StockRequestRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  shopId: string;

  @ApiProperty({ type: [StockRequestItemRequest] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockRequestItemRequest)
  items: StockRequestItemRequest[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
