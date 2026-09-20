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

  @Prop({ type: String, default: null })
  @ApiProperty()
  logo: string | null;

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

  // Drives InventoryUtilsService.computeStockHealth - FixedQuantity compares
  // quantity against the item's own reorderLevel (falling back to
  // lowStockThresholdQuantity when it's unset), DaysOfCover projects days
  // remaining from recent sales velocity and compares that to
  // lowStockThresholdDays. Read by both Inventory (warehouse) and
  // ShopInventory list/getById.
  @Prop({
    type: String,
    enum: LowStockThresholdMode,
    default: LowStockThresholdMode.FixedQuantity,
  })
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

  // ---- Security ----
  // sessionTimeoutMinutes used to live here, but a login's lifetime is now
  // an env/ops concern (SESSION_TIMEOUT_MINUTES) rather than admin-editable
  // per-tenant config - see configuration/index.ts.

  @Prop({ default: true })
  @ApiProperty()
  forcePasswordChangeOnReset: boolean;

  // ---- Operations ----

  // A platform-wide kill switch - checked first in SaleService.create,
  // before any other validation, and blocks every payment method at every
  // shop. The checkout page itself stays browsable; only completing a sale
  // is blocked (see checkoutDisabledMessage, shown there as a banner).
  @Prop({ default: true })
  @ApiProperty()
  checkoutEnabled: boolean;

  // Required (see SettingsRequest) whenever checkoutEnabled is false, so
  // staff always see why they're locked out rather than a generic error.
  @Prop({ type: String, default: null })
  @ApiProperty()
  checkoutDisabledMessage: string | null;

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
