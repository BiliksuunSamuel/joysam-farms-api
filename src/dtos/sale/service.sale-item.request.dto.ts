import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

// Price is always resolved server-side, never trusted here - either the
// service's current base price, or one of its specialFees if feeLabel
// names one (see SaleService.resolveServiceSaleItems). The service
// equivalent of SaleItemRequest.
export class ServiceSaleItemRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  serviceId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;

  // Omit to charge the service's base price - a cashier picks this
  // instead of calculating a proportional price themselves (e.g. "Half").
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  feeLabel?: string;
}
