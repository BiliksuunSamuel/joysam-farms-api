import { randomUUID } from 'crypto';
import { UserResponse } from 'src/dtos/user/user.response.dto';
import { CustomerInfo } from 'src/models/customer/customer-info.model';
import { InventoryInfo } from 'src/models/inventory/inventory-info.model';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { SupplierInfo } from 'src/models/supplier/supplier-info.model';
import { UserInfo } from 'src/models/user/user-info.model';
import { VendorInfo } from 'src/models/vendor/vendor-info.model';
import * as bcrypt from 'bcrypt';
import {
  CountryCode,
  isValidPhoneNumber as isValidPhoneNumberLib,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';

const DEFAULT_PHONE_COUNTRY: CountryCode = 'GH';

export function generateId() {
  return randomUUID().replace(/-/g, '');
}

export function isValidPhoneNumber(
  phone: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): boolean {
  return isValidPhoneNumberLib(phone, defaultCountry);
}

export function toInternationalPhoneNumber(
  phone: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string | null {
  const parsed = parsePhoneNumberFromString(phone, defaultCountry);
  return parsed?.isValid() ? parsed.number.slice(1) : null;
}

export function normalizePhone<T extends string | undefined | null>(
  phone: T,
): T {
  if (!phone) return phone;
  return (toInternationalPhoneNumber(phone) ?? phone) as T;
}

//a random, fixed-length numeric code, e.g. generateNumericCode(8) -> "04839201"
export function generateNumericCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

//build a point-in-time snapshot of a shop, for embedding on other documents
export function toShopInfo(shop): ShopInfo {
  return {
    id: shop.id,
    name: shop.name,
    location: shop.location,
    phone: shop.phone,
  };
}

//build a point-in-time snapshot of a supplier, for embedding on other documents
export function toSupplierInfo(supplier): SupplierInfo {
  return {
    id: supplier.id,
    name: supplier.name,
    contactName: supplier.contactName,
    phone: supplier.phone,
  };
}

//build a point-in-time snapshot of a vendor, for embedding on other documents
export function toVendorInfo(vendor): VendorInfo {
  return {
    id: vendor.id,
    name: vendor.name,
    contactName: vendor.contactName,
  };
}

//build a point-in-time snapshot of a customer, for embedding on other documents
export function toCustomerInfo(customer): CustomerInfo {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
  };
}

//build a point-in-time snapshot of an inventory item, for embedding on other documents
export function toInventoryInfo(inventory): InventoryInfo {
  return {
    id: inventory.id,
    name: inventory.name,
    categoryId: inventory.categoryId,
    description: inventory.description,
    unit: inventory.unit,
    price: inventory.price,
    serialNumber: inventory.serialNumber,
    barcode: inventory.barcode,
  };
}

export function toUserInfo(user, roleName?: string): UserInfo {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    roleName: roleName ?? null,
  };
}

export function toUserResponse(user): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    roleId: user.roleId,
    status: user.status,
    shopId: user.shopId,
    shopInfoSnapshot: user.shopInfoSnapshot,
    permissionKeys: user.permissionKeys ?? [],
    allPermissions: user.allPermissions ?? false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    updatedBy: user.updatedBy,
    createdBy: user.createdBy,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function toPaginationInfo(object: any): {
  page: number;
  pageSize: number;
} {
  const page = object?.page;
  const pageSize = object?.pageSize;
  return {
    page: !isNaN(page) ? parseInt(page) : 1,
    pageSize: !isNaN(pageSize) ? parseInt(pageSize) : 10,
  };
}

// Shared Day/Week/Month time-bucketing for trend endpoints (ledger cash
// flow, stock request activity) that don't need SalesTrend's fuller
// Hour/Year/Shop/Cashier set. Every function here must stay in exact sync
// with SaleService's own Hour/Day/Week/Month/Year bucketing (particularly
// isoWeekKey, which matches Mongo's %G-%V $dateToString format) - they're
// kept as separate copies rather than one shared type so each trend feature
// can evolve its own grouping options independently.
export type DayWeekMonthGroupBy = 'Day' | 'Week' | 'Month';

export function resolveDayWeekMonthRange(
  startDate: Date | undefined,
  endDate: Date | undefined,
  groupBy: DayWeekMonthGroupBy,
): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  if (startDate) {
    return { start: new Date(startDate), end };
  }

  const start = new Date(end);
  switch (groupBy) {
    case 'Week':
      start.setUTCDate(start.getUTCDate() - 56); // last 8 weeks
      break;
    case 'Month':
      start.setUTCMonth(start.getUTCMonth() - 11); // last 12 months
      break;
    case 'Day':
    default:
      start.setUTCDate(start.getUTCDate() - 6); // last 7 days
      break;
  }
  return { start, end };
}

export function startOfDayWeekMonthBucket(
  date: Date,
  groupBy: DayWeekMonthGroupBy,
): Date {
  const d = new Date(date);
  switch (groupBy) {
    case 'Week': {
      const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
      d.setUTCDate(d.getUTCDate() - dayNum);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    case 'Month':
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    case 'Day':
    default:
      d.setUTCHours(0, 0, 0, 0);
      return d;
  }
}

export function advanceDayWeekMonthBucket(
  date: Date,
  groupBy: DayWeekMonthGroupBy,
): Date {
  const d = new Date(date);
  switch (groupBy) {
    case 'Week':
      d.setUTCDate(d.getUTCDate() + 7);
      return d;
    case 'Month':
      d.setUTCMonth(d.getUTCMonth() + 1);
      return d;
    case 'Day':
    default:
      d.setUTCDate(d.getUTCDate() + 1);
      return d;
  }
}

//must match the $dateToString format used for the same groupBy in the
//repository's aggregation exactly, since this is how gap-filled buckets are
//matched up against real aggregation results
export function dayWeekMonthBucketKey(
  date: Date,
  groupBy: DayWeekMonthGroupBy,
): string {
  switch (groupBy) {
    case 'Week':
      return isoWeekKey(date);
    case 'Month':
      return date.toISOString().slice(0, 7);
    case 'Day':
    default:
      return date.toISOString().slice(0, 10);
  }
}

//UTC midnight of the calendar day `date` falls on - Ghana has no timezone
//offset, so this is also local midnight (see DailyReportGenerationService).
export function startOfUTCDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

//ISO 8601 week-numbering year + week, e.g. "2026-W38" - matches Mongo's
//%G-%V format exactly, including the year-boundary edge case where the
//first/last days of a calendar year belong to a week in the adjacent ISO
//year.
export function isoWeekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this ISO week
  const isoYear = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4DayNum);
  const weekNum =
    Math.round((d.getTime() - week1Monday.getTime()) / (7 * 86_400_000)) + 1;
  return `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * The shopId a request should be forced to, or null if the requester isn't
 * tied to one shop and can see whatever they're permitted to. A shop-scoped
 * employee never gets to choose - their own fresh shopId always overrides
 * whatever the client asked for, the same way GET my-shop already works
 * (see AuthenticationController.myShop). Structurally typed rather than
 * importing UserRepository, to avoid a circular import back into utils.
 */
export async function resolveRequesterShopId(
  requesterId: string,
  userRepository: { getById(id: string): Promise<{ shopId?: string } | null> },
): Promise<string | null> {
  const requester = await userRepository.getById(requesterId);
  return requester?.shopId || null;
}
