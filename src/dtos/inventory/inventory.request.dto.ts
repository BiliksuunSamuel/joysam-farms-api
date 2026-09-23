import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { InventoryStatus, Unit } from 'src/enums';

// No serialNumber/barcode here - both are generated server-side.
export class InventoryRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  categoryId: string;

  @ApiProperty({ enum: Unit, required: false })
  @IsOptional()
  @IsEnum(Unit)
  unit?: Unit;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderLevel?: number;

  @ApiProperty({ enum: InventoryStatus, required: false })
  @IsOptional()
  @IsEnum(InventoryStatus)
  status?: InventoryStatus;

  // On create, paired with `supplierId` below to log the initial quantity as
  // a delivery. On update it's a manual correction only - the normal way
  // this gets set afterwards is a SupplyRequest approval (see
  // SupplyRequestItemRequest.expiryDate).
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  // Create only - if set alongside a positive `quantity`, that initial
  // stock is logged as a delivery from this supplier (a SupplierLedgerEntry
  // Bill + a SupplierInventoryLedgerEntry), the same as approving a
  // SupplyRequest does. Ignored on update - InventoryService.update() never
  // reads it, since an edit's `quantity` overwrites the total rather than
  // representing a new delivery.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplierId?: string;
}
