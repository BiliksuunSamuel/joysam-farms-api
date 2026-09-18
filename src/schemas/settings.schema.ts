import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { LowStockThresholdMode } from 'src/enums';
import { UserInfo } from 'src/models/user/user-info.model';

// A singleton - there is only ever one Settings document for the whole
// platform (this isn't multi-tenant). See SettingsRepository for how that's
// enforced.
@Schema()
export class Settings extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  businessName: string;

  @Prop({ default: 'GHS' })
  @ApiProperty()
  currency: string;

  @Prop({ default: null })
  @ApiProperty()
  contactEmail: string;

  @Prop({ default: null })
  @ApiProperty()
  contactPhone: string;

  @Prop({ default: null })
  @ApiProperty()
  address: string;

  @Prop({ default: null })
  @ApiProperty()
  registeredName: string;

  // GhanaPostGPS digital address, e.g. "GA-543-0192".
  @Prop({ default: null })
  @ApiProperty()
  digitalAddress: string;

  // ---- Shops & receipts ----

  @Prop({ default: null })
  @ApiProperty()
  receiptFooter: string;

  @Prop({ default: 0 })
  @ApiProperty()
  taxRatePercent: number;

  @Prop({ default: false })
  @ApiProperty()
  showTaxOnReceipts: boolean;

  // ---- Inventory ----

  // Persisted only for now - nothing in the app reads Inventory.reorderLevel
  // for a low-stock report/alert yet, so there's no behaviour to attach
  // these to (unlike transfersRequireApproval/stockAdjustmentsRequireReason
  // below, which gate real, existing endpoints).
  @Prop({ enum: LowStockThresholdMode, default: LowStockThresholdMode.FixedQuantity })
  @ApiProperty({ enum: LowStockThresholdMode })
  lowStockThresholdMode: LowStockThresholdMode;

  @Prop({ default: 10 })
  @ApiProperty()
  lowStockThresholdQuantity: number;

  @Prop({ default: 3 })
  @ApiProperty()
  lowStockThresholdDays: number;

  @Prop({ default: true })
  @ApiProperty()
  transfersRequireApproval: boolean;

  @Prop({ default: true })
  @ApiProperty()
  stockAdjustmentsRequireReason: boolean;

  // ---- Credit & vendors ----

  // The termsDays a new Vendor is created with by default - doesn't affect
  // vendors that already exist.
  @Prop({ default: 30 })
  @ApiProperty()
  defaultVendorTermsDays: number;

  @Prop({ default: false })
  @ApiProperty()
  blockCreditSalesWhenOverdue: boolean;

  @Prop({ default: 0 })
  @ApiProperty()
  overdueGraceDays: number;

  // ---- Security ----

  @Prop({ default: 480 })
  @ApiProperty()
  sessionTimeoutMinutes: number;

  @Prop({ default: true })
  @ApiProperty()
  forcePasswordChangeOnReset: boolean;

  // ---- Notifications ----
  // Preferences only - nothing sends an email or an in-app notification yet.

  @Prop({ default: true })
  @ApiProperty()
  notifyLowStock: boolean;

  @Prop({ default: true })
  @ApiProperty()
  notifyStockRequests: boolean;

  @Prop({ default: true })
  @ApiProperty()
  notifyOverdueVendors: boolean;

  @Prop({ default: false })
  @ApiProperty()
  notifyDailySummary: boolean;

  // Who last saved these settings, and a snapshot of their name at the time
  // - the same denormalised-snapshot pattern as shopInfoSnapshot/vendorInfoSnapshot,
  // so the Business profile card can show "last updated by X" without a live join.
  @Prop({ default: null })
  @ApiProperty()
  updatedByInfoSnapshot: UserInfo;
}
