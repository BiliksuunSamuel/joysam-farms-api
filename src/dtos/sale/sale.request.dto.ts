import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { SalePaymentMethod } from 'src/enums';
import { SaleItemRequest } from './sale.item.request.dto';

export class SaleRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  shopId: string;

  @ApiProperty({ type: [SaleItemRequest] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemRequest)
  items: SaleItemRequest[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({ enum: SalePaymentMethod })
  @IsEnum(SalePaymentMethod)
  paymentMethod: SalePaymentMethod;

  // Required when paymentMethod is Cash - how much the buyer handed over.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountTendered?: number;

  // Required when paymentMethod is Credit - who this sale is billed to.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  vendorId?: string;

  // Credit only - a memo for the vendor's ledger (e.g. what this order was
  // for, or an arrangement made with them).
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  vendorNote?: string;

  // Credit only - overrides the vendor's usual termsDays-based due date for
  // this specific sale (e.g. a negotiated exception). Omit to use the
  // vendor's default terms.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  vendorDueDate?: string;
}
