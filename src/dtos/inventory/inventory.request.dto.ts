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
  // a delivery. On update, just the item's own shelf-life date - the normal
  // way this gets set afterwards is a SupplyRequest approval (see
  // SupplyRequestItemRequest.expiryDate).
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  // If set alongside a `quantity` that's higher than the item's current
  // one, that increase is logged as a delivery from this supplier (a
  // SupplierLedgerEntry Bill + a SupplierInventoryLedgerEntry) - on create,
  // the increase is the full initial quantity; on update, just the delta
  // (see InventoryService.update). Ignored if quantity isn't increasing.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplierId?: string;

  // Update only - the business date this quantity change reflects, and why.
  // Not stored on the item itself; see InventoryAdjustment, the only place
  // either is actually captured (the generic AuditLog entry this same
  // request also produces has no room for request-specific detail).
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  adjustmentDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adjustmentNote?: string;
}
