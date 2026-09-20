import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { CashFlowSummary } from 'src/models/daily-report/cash-flow-summary.model';
import { ExpenseSummary } from 'src/models/daily-report/expense-summary.model';
import { InventoryMovement } from 'src/models/daily-report/inventory-movement.model';
import { PaymentStatusBreakdownItem } from 'src/models/daily-report/payment-status-breakdown-item.model';
import { SalesSummary } from 'src/models/daily-report/sales-summary.model';
import { ShopInfo } from 'src/models/shop/shop-info.model';

const ShopInfoSchema = SchemaFactory.createForClass(ShopInfo);
const SalesSummarySchema = SchemaFactory.createForClass(SalesSummary);
const CashFlowSummarySchema = SchemaFactory.createForClass(CashFlowSummary);
const PaymentStatusBreakdownItemSchema = SchemaFactory.createForClass(
  PaymentStatusBreakdownItem,
);
const ExpenseSummarySchema = SchemaFactory.createForClass(ExpenseSummary);
const InventoryMovementSchema = SchemaFactory.createForClass(InventoryMovement);

// One row per (shopId, date) - a materialized snapshot of a single calendar
// day, generated nightly by DailyReportGenerationService (and on demand via
// the manual regenerate endpoint). shopId null = the organisation-wide
// rollup, same convention as Expense.shopId. Never edited in place outside
// of a regeneration - DailyReportRepository.upsert always replaces the full
// document for that (shopId, date).
@Schema()
export class DailyReport extends BaseSchema {
  @Prop({ default: null })
  @ApiProperty()
  shopId: string | null;

  @Prop({ type: ShopInfoSchema, default: null })
  @ApiProperty({ type: ShopInfo })
  shopInfoSnapshot: ShopInfo | null;

  // UTC midnight of the calendar day this report covers - Ghana has no
  // timezone offset, so this is also local midnight.
  @Prop({ required: true })
  @ApiProperty()
  date: Date;

  @Prop({ required: true })
  @ApiProperty()
  generatedAt: Date;

  @Prop({ type: SalesSummarySchema, required: true })
  @ApiProperty({ type: SalesSummary })
  sales: SalesSummary;

  @Prop({ type: CashFlowSummarySchema, required: true })
  @ApiProperty({ type: CashFlowSummary })
  cashFlow: CashFlowSummary;

  @Prop({ type: [PaymentStatusBreakdownItemSchema], default: [] })
  @ApiProperty({ type: [PaymentStatusBreakdownItem] })
  payments: PaymentStatusBreakdownItem[];

  @Prop({ type: ExpenseSummarySchema, required: true })
  @ApiProperty({ type: ExpenseSummary })
  expenses: ExpenseSummary;

  @Prop({ type: InventoryMovementSchema, required: true })
  @ApiProperty({ type: InventoryMovement })
  inventoryMovement: InventoryMovement;
}
