export enum WeekDay {
  Monday = 'Monday',
  Tuesday = 'Tuesday',
  Wednesday = 'Wednesday',
  Thursday = 'Thursday',
  Friday = 'Friday',
  Saturday = 'Saturday',
  Sunday = 'Sunday',
}

export enum ShopStatus {
  Open = 'Open',
  Closed = 'Closed',
}

export enum ShopType {
  GeneralStore = 'GeneralStore',
  Supermarket = 'Supermarket',
  Pharmacy = 'Pharmacy',
  Kiosk = 'Kiosk',
  Wholesale = 'Wholesale',
}

export enum UserAuthSessionStatus {
  Active = 'Active',
  Revoked = 'Revoked',
}

export enum UserStatus {
  Active = 'Active',
  Invited = 'Invited',
  Disabled = 'Disabled',
}

export enum Unit {
  Crate = 'Crate',
  Kg = 'Kg',
  Tray = 'Tray',
  Bunch = 'Bunch',
  Bag = 'Bag',
  Piece = 'Piece',
  Basket = 'Basket',
}

export enum InventoryStatus {
  Available = 'Available',
  Unavailable = 'Unavailable',
}

export enum ShopInventoryStatus {
  Available = 'Available',
  Unavailable = 'Unavailable',
}

export enum TransferStatus {
  Pending = 'Pending',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

export enum StockRequestStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export enum ExpenseCategory {
  Rent = 'Rent',
  Utilities = 'Utilities',
  Wages = 'Wages',
  Transport = 'Transport',
  Supplies = 'Supplies',
  Maintenance = 'Maintenance',
  Marketing = 'Marketing',
  Other = 'Other',
}

export enum ExpensePaymentMethod {
  Cash = 'Cash',
  MobileMoney = 'MobileMoney',
  BankTransfer = 'BankTransfer',
  Card = 'Card',
}

export enum ExpenseStatus {
  Paid = 'Paid',
  Pending = 'Pending',
}

export enum ExpenseTrendGroupBy {
  Day = 'Day',
  Week = 'Week',
  Month = 'Month',
}

export enum LedgerEntryType {
  Credit = 'Credit',
  Debit = 'Debit',
}

export enum LedgerSource {
  Sale = 'Sale',
  Expense = 'Expense',
  Adjustment = 'Adjustment',
  VendorPayment = 'VendorPayment',
  SupplierPayment = 'SupplierPayment',
}

export enum SalePaymentMethod {
  Cash = 'Cash',
  // Manual entry (network + phone), recorded by the cashier - no gateway,
  // settles instantly. UI label is deliberately NOT "Mobile Money" (see
  // Digital below) to avoid colliding with the real gateway rail.
  MobileMoney = 'MobileMoney',
  // The real payment gateway (Paystack) - card and mobile money, via a
  // redirect to Paystack's hosted checkout. UI label is "Mobile Money"
  // since that's what users expect, even though it also accepts cards.
  // Async: see SaleStatus.Pending and PaymentTransactionService.
  Digital = 'Digital',
  // Billed to a vendor's credit account - no cash changes hands at the
  // till, so the shop's own cash ledger isn't credited until the vendor
  // later pays (see SaleService.create and VendorService.recordPayment).
  Credit = 'Credit',
  // Exactly two legs - one Cash + one MobileMoney - see Sale.payments.
  // Credit is never split.
  Split = 'Split',
}

export enum SaleStatus {
  // Digital only - created (and stock deducted) the instant the cashier
  // charges, but not yet paid. Every other payment method goes straight to
  // Completed, since they're all settled synchronously at the till.
  Pending = 'Pending',
  Completed = 'Completed',
  Voided = 'Voided',
}

// A manual void request on a Completed sale - see Sale.voidRequest. Distinct
// from SaleStatus.Voided itself: a sale only actually transitions to Voided
// once its void request is Approved (immediately, in Instant mode - see
// VoidApprovalMode - or after a reviewer approves it).
export enum VoidRequestStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export enum VoidApprovalMode {
  Instant = 'Instant',
  RequiresApproval = 'RequiresApproval',
}

export enum PaymentTransactionStatus {
  Pending = 'Pending',
  Success = 'Success',
  Failed = 'Failed',
  Abandoned = 'Abandoned',
}

// Time-based only (unlike SalesTrendGroupBy) - a payment-gateway trend is a
// single-domain volume/success-rate metric, not a multi-dimension breakdown.
export enum PaymentTransactionTrendGroupBy {
  Hour = 'Hour',
  Day = 'Day',
  Week = 'Week',
  Month = 'Month',
  Year = 'Year',
}

export enum SalesTrendGroupBy {
  Hour = 'Hour',
  Day = 'Day',
  Week = 'Week',
  Month = 'Month',
  Year = 'Year',
  Shop = 'Shop',
  Cashier = 'Cashier',
  Category = 'Category',
}

export enum StockBreakdownGroupBy {
  Category = 'Category',
  Product = 'Product',
}

export enum LedgerTrendGroupBy {
  Day = 'Day',
  Week = 'Week',
  Month = 'Month',
}

export enum StockRequestTrendGroupBy {
  Day = 'Day',
  Week = 'Week',
  Month = 'Month',
}

export enum SupplierStatus {
  Active = 'Active',
  Inactive = 'Inactive',
}

export enum SupplyRequestStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

// A Vendor is a buyer (a restaurant, chop bar, hotel etc.) who buys from
// JoySam Farms on credit - the opposite relationship from a Supplier, who
// JoySam Farms buys from to restock the warehouse.
export enum VendorStatus {
  Active = 'Active',
  OnHold = 'OnHold',
}

// Charge always increases what a vendor owes (a credit sale); Payment
// always decreases it - there's no separate "direction" concept to track,
// since it's fully determined by which of these an entry is. (Adjustment
// is the one case that can go either way - see VendorLedgerEntry.amount.)
// Deliberately not named/valued "Debit"/"Credit": that word already means
// something specific and different in this domain - SalePaymentMethod.Credit,
// selling to a vendor on credit - and reusing it here for a payment would
// suggest a payment *grants* the vendor spendable credit, which it doesn't.
export enum VendorLedgerEntryType {
  Charge = 'Charge',
  Payment = 'Payment',
  Adjustment = 'Adjustment',
}

export enum VendorPaymentMethod {
  Cash = 'Cash',
  MobileMoney = 'MobileMoney',
  BankTransfer = 'BankTransfer',
}

// Bill always increases what we owe a supplier (goods received into the
// warehouse); Payment always decreases it. Adjustment is the one case that
// can go either way (see SupplierLedgerEntry.amount). Deliberately not
// "Charge"/"Debit"/"Credit" - same reasoning as VendorLedgerEntryType.
export enum SupplierLedgerEntryType {
  Bill = 'Bill',
  Payment = 'Payment',
  Adjustment = 'Adjustment',
}

export enum SupplierPaymentMethod {
  Cash = 'Cash',
  MobileMoney = 'MobileMoney',
  BankTransfer = 'BankTransfer',
}

// How Settings.lowStockThresholdQuantity/lowStockThresholdDays should be
// read - a fixed unit count, or a projected days-of-cover based on recent
// sales - see InventoryUtilsService.computeStockHealth for where this is
// actually applied.
export enum LowStockThresholdMode {
  FixedQuantity = 'FixedQuantity',
  DaysOfCover = 'DaysOfCover',
}

// How Settings.discountMaxFlatAmount/discountMaxPercentage caps a
// checkout discount - see SaleService.create for where this is enforced.
export enum DiscountLimitType {
  Flat = 'Flat',
  Percentage = 'Percentage',
}
