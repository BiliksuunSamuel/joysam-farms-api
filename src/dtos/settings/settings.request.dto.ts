import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { LowStockThresholdMode } from 'src/enums';

export class SettingsRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  businessName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  registeredName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  digitalAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logo?: string;

  // ---- Shops & receipts ----

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  receiptFooter?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Min(0)
  taxRatePercent?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  showTaxOnReceipts?: boolean;

  // ---- Inventory ----

  @ApiProperty({ required: false, enum: LowStockThresholdMode })
  @IsOptional()
  @IsEnum(LowStockThresholdMode)
  lowStockThresholdMode?: LowStockThresholdMode;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThresholdQuantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThresholdDays?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  transfersRequireApproval?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  stockAdjustmentsRequireReason?: boolean;

  // ---- Security ----
  // sessionTimeoutMinutes used to live here - see settings.schema.ts.

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  forcePasswordChangeOnReset?: boolean;

  // ---- Operations ----

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  checkoutEnabled?: boolean;

  // Only required when checkoutEnabled is explicitly being turned off -
  // otherwise this field is untouched/irrelevant.
  @ApiProperty({ required: false })
  @ValidateIf((o: SettingsRequest) => o.checkoutEnabled === false)
  @IsNotEmpty({
    message: 'A message for staff is required when checkout is turned off',
  })
  @IsString()
  checkoutDisabledMessage?: string;

  // ---- Notifications ----

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifyLowStock?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifyStockRequests?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifyOverdueVendors?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifyDailySummary?: boolean;
}
