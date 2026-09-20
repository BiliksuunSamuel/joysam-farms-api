import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  ExpenseStatus,
  LedgerTrendGroupBy,
  SalesTrendGroupBy,
} from 'src/enums';
import { CategoryRepository } from 'src/repositories/category.repository';
import {
  DailyReportRepository,
  DailyReportSections,
} from 'src/repositories/daily-report.repository';
import { ExpenseRepository } from 'src/repositories/expense.repository';
import { LedgerEntryRepository } from 'src/repositories/ledger-entry.repository';
import { PaymentTransactionRepository } from 'src/repositories/payment-transaction.repository';
import { SaleRepository } from 'src/repositories/sale.repository';
import { ShopRepository } from 'src/repositories/shop.repository';
import { StockRequestRepository } from 'src/repositories/stock-request.repository';
import { TransferRepository } from 'src/repositories/transfer.repository';
import { DailyReport } from 'src/schemas/daily-report.schema';
import { startOfUTCDay, toShopInfo } from 'src/utils';

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  Cash: 'cash',
  Digital: 'Mobile Money',
  Credit: 'vendor credit',
  MobileMoney: 'Mobile Money (manual)',
};

const money = (n: number) => `GH₵${n.toFixed(2)}`;
const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

// A relative phrase for `to` versus `from` - null when `from` is 0, since a
// percentage change off a zero base is meaningless (and division by zero).
function trendPhrase(from: number, to: number): string | null {
  if (!from) return null;
  const change = Math.round(((to - from) / from) * 100);
  if (change === 0) return 'flat versus yesterday';
  return `${Math.abs(change)}% ${change > 0 ? 'up on' : 'down from'} yesterday`;
}

// The single shared core, generating one shop's report or the org-wide
// rollup for one calendar day - reused by BOTH the nightly cron and the
// manual regenerate endpoint (DailyReportService.generate), the same way
// PaymentTransactionService.confirmDigitalPayment is the one shared core
// reused by the webhook/poll/sweep in the payments feature.
@Injectable()
export class DailyReportGenerationService {
  private readonly logger = new Logger(DailyReportGenerationService.name);

  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly expenseRepository: ExpenseRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly paymentTransactionRepository: PaymentTransactionRepository,
    private readonly stockRequestRepository: StockRequestRepository,
    private readonly transferRepository: TransferRepository,
    private readonly shopRepository: ShopRepository,
    private readonly dailyReportRepository: DailyReportRepository,
  ) {}

  // Just after UTC midnight - Ghana has no timezone offset, so this is also
  // local midnight. Generates yesterday's report for every shop, plus the
  // organisation-wide rollup.
  @Cron('10 0 * * *')
  async runNightlyGeneration() {
    const date = startOfUTCDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
    this.logger.log(`generating daily reports for ${date.toISOString()}`);

    const shops = await this.shopRepository.listForDropdown({});
    for (const shop of shops) {
      await this.generateForShop(shop.id, date);
    }
    await this.generateOrgWide(date);
  }

  async generateForShop(shopId: string, date: Date): Promise<DailyReport> {
    const shop = await this.shopRepository.getById(shopId);
    const sections = await this.buildSections(shopId, date);
    const previous = await this.getPreviousReport(shopId, date);
    const narrative = this.buildNarrative(
      shop?.name ?? 'This shop',
      sections,
      previous,
    );
    return await this.dailyReportRepository.upsert(
      shopId,
      startOfUTCDay(date),
      {
        ...sections,
        narrative,
        shopInfoSnapshot: shop ? toShopInfo(shop) : null,
      },
    );
  }

  async generateOrgWide(date: Date): Promise<DailyReport> {
    const sections = await this.buildSections(undefined, date);
    const previous = await this.getPreviousReport(null, date);
    const narrative = this.buildNarrative(
      'The organisation',
      sections,
      previous,
    );
    return await this.dailyReportRepository.upsert(null, startOfUTCDay(date), {
      ...sections,
      narrative,
      shopInfoSnapshot: null,
    });
  }

  private async getPreviousReport(
    shopId: string | null,
    date: Date,
  ): Promise<DailyReport | null> {
    const dayStart = startOfUTCDay(date);
    const previousDayStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
    return await this.dailyReportRepository.getByShopAndDate(
      shopId,
      previousDayStart,
    );
  }

  // shopId undefined = organisation-wide, for every underlying query.
  private async buildSections(
    shopId: string | undefined,
    date: Date,
  ): Promise<Omit<DailyReportSections, 'shopInfoSnapshot' | 'narrative'>> {
    const dayStart = startOfUTCDay(date);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    // SaleRepository.getTrend / LedgerEntryRepository.getTrend use $lte
    // internally (existing, unchanged) - every new method added for this
    // feature uses $lt on an exclusive dayEnd instead.
    const trendEnd = new Date(dayEnd.getTime() - 1);
    const shopFilter = shopId ? { shopId } : {};

    const [dayTotals] = await this.saleRepository.getTrend({
      ...shopFilter,
      groupBy: SalesTrendGroupBy.Day,
      startDate: dayStart,
      endDate: trendEnd,
    } as any);
    const categoryRows = await this.saleRepository.getTrend({
      ...shopFilter,
      groupBy: SalesTrendGroupBy.Category,
      startDate: dayStart,
      endDate: trendEnd,
    } as any);

    // Duplicated (not reused) from SaleService.getSalesTrend's own name
    // resolution - that version is coupled to a live requester via
    // resolveRequesterShopId, which doesn't exist inside a cron job.
    const categoryIds = categoryRows
      .map((r) => r.key)
      .filter((id): id is string => !!id);
    const categories = await this.categoryRepository.getByIds(categoryIds);
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
    const unitsSold = categoryRows.reduce((sum, r) => sum + r.value2, 0);

    const paymentMethodBreakdown =
      await this.saleRepository.getPaymentMethodTotals(
        shopId,
        dayStart,
        dayEnd,
      );
    const splitSalesTotals = await this.saleRepository.getSplitSalesTotals(
      shopId,
      dayStart,
      dayEnd,
    );

    const [openingBalance, closingBalance] = await Promise.all([
      this.ledgerEntryRepository.getBalanceAsOf(shopId, dayStart),
      this.ledgerEntryRepository.getBalanceAsOf(shopId, trendEnd),
    ]);
    const [cashFlowDay] = await this.ledgerEntryRepository.getTrend({
      ...shopFilter,
      groupBy: LedgerTrendGroupBy.Day,
      startDate: dayStart,
      endDate: trendEnd,
    } as any);

    const paymentBreakdown =
      await this.paymentTransactionRepository.getStatusBreakdown(
        shopId,
        dayStart,
        dayEnd,
      );
    const expenseRows = await this.expenseRepository.getCategoryTotals(
      shopId,
      dayStart,
      dayEnd,
      ExpenseStatus.Paid,
    );
    const stockRequestsCreated = await this.stockRequestRepository.countCreated(
      shopId,
      dayStart,
      dayEnd,
    );
    const transfersCompleted = await this.transferRepository.countCompleted(
      shopId,
      dayStart,
      dayEnd,
    );

    return {
      sales: {
        revenue: dayTotals?.value1 ?? 0,
        transactionCount: dayTotals?.value2 ?? 0,
        unitsSold,
        categoryBreakdown: categoryRows.map((r) => ({
          categoryId: r.key ?? null,
          categoryName: r.key
            ? (categoryNameById.get(r.key) ?? 'Uncategorized')
            : 'Uncategorized',
          revenue: r.value1,
          unitsSold: r.value2,
        })),
        paymentMethodBreakdown,
        splitSalesCount: splitSalesTotals.count,
        splitSalesValue: splitSalesTotals.value,
      },
      cashFlow: {
        openingBalance,
        closingBalance,
        totalInflow: cashFlowDay?.value1 ?? 0,
        totalOutflow: cashFlowDay?.value2 ?? 0,
      },
      payments: paymentBreakdown,
      expenses: {
        total: expenseRows.reduce((sum, r) => sum + r.amount, 0),
        categoryBreakdown: expenseRows,
      },
      inventoryMovement: {
        unitsSold,
        stockRequestsCreated,
        transfersCompleted,
      },
    };
  }

  // Deterministic, template-built prose covering every section above - not
  // an LLM call (no external dependency, no cost, no wording drift between
  // regenerations of the same underlying numbers). `previous` is yesterday's
  // report for the same shopId, if one was ever generated - comparisons are
  // skipped gracefully when it isn't there (first day, or a gap in the
  // history) rather than showing a misleading 0% or crashing on a divide by
  // zero (see trendPhrase).
  private buildNarrative(
    subject: string,
    sections: Omit<DailyReportSections, 'shopInfoSnapshot' | 'narrative'>,
    previous: DailyReport | null,
  ): string {
    const { sales, cashFlow, payments, expenses, inventoryMovement } = sections;
    const paragraphs: string[] = [];

    // Sales
    if (sales.transactionCount > 0) {
      const topCategory = [...sales.categoryBreakdown].sort(
        (a, b) => b.revenue - a.revenue,
      )[0];
      let p = `${subject} recorded ${money(sales.revenue)} in revenue from ${plural(sales.transactionCount, 'sale')} today, selling ${plural(sales.unitsSold, 'unit')}`;
      if (topCategory) {
        p += `, led by ${topCategory.categoryName} (${money(topCategory.revenue)})`;
      }
      p += '.';
      const revenueTrend = previous
        ? trendPhrase(previous.sales.revenue, sales.revenue)
        : null;
      if (revenueTrend) p += ` That's revenue ${revenueTrend}.`;
      if (sales.splitSalesCount > 0) {
        p += ` ${plural(sales.splitSalesCount, 'sale')} ${sales.splitSalesCount === 1 ? 'was' : 'were'} split between cash and Mobile Money, totalling ${money(sales.splitSalesValue)}.`;
      }
      paragraphs.push(p);

      const mix = sales.paymentMethodBreakdown
        .filter((m) => m.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .map(
          (m) =>
            `${money(m.revenue)} in ${PAYMENT_METHOD_LABEL[m.method] ?? m.method}`,
        )
        .join(', ');
      if (mix) paragraphs.push(`Payment mix: ${mix}.`);
    } else {
      paragraphs.push(`${subject} recorded no sales today.`);
    }

    // Cash flow
    const net = cashFlow.closingBalance - cashFlow.openingBalance;
    let cf = `The cash position moved from ${money(cashFlow.openingBalance)} to ${money(cashFlow.closingBalance)} (${net >= 0 ? 'up' : 'down'} ${money(Math.abs(net))}), with ${money(cashFlow.totalInflow)} in and ${money(cashFlow.totalOutflow)} out.`;
    const balanceTrend = previous
      ? trendPhrase(previous.cashFlow.closingBalance, cashFlow.closingBalance)
      : null;
    if (balanceTrend) cf += ` The closing balance is ${balanceTrend}.`;
    paragraphs.push(cf);

    // Payment transactions (Paystack)
    const totalPayments = payments.reduce((sum, p) => sum + p.count, 0);
    if (totalPayments > 0) {
      const successCount =
        payments.find((p) => p.status === 'Success')?.count ?? 0;
      const failedCount =
        payments.find((p) => p.status === 'Failed')?.count ?? 0;
      const abandonedCount =
        payments.find((p) => p.status === 'Abandoned')?.count ?? 0;
      const successRate = Math.round((successCount / totalPayments) * 100);
      let pp = `${successCount} of ${plural(totalPayments, 'Mobile Money transaction')} succeeded (${successRate}%)`;
      if (failedCount > 0 || abandonedCount > 0) {
        const parts: string[] = [];
        if (failedCount > 0) parts.push(`${plural(failedCount, 'failure')}`);
        if (abandonedCount > 0)
          parts.push(`${plural(abandonedCount, 'abandonment')}`);
        pp += ` - ${parts.join(' and ')}`;
      }
      pp += '.';
      paragraphs.push(pp);
    }

    // Expenses
    if (expenses.total > 0) {
      const topExpenseCategory = [...expenses.categoryBreakdown].sort(
        (a, b) => b.amount - a.amount,
      )[0];
      let ep = `${money(expenses.total)} was spent on expenses today`;
      if (topExpenseCategory) ep += `, mostly ${topExpenseCategory.category}`;
      ep += '.';
      const expenseTrend = previous
        ? trendPhrase(previous.expenses.total, expenses.total)
        : null;
      if (expenseTrend) ep += ` That's expenses ${expenseTrend}.`;
      paragraphs.push(ep);
    } else {
      paragraphs.push('No expenses were recorded today.');
    }

    // Inventory movement
    if (
      inventoryMovement.stockRequestsCreated > 0 ||
      inventoryMovement.transfersCompleted > 0
    ) {
      paragraphs.push(
        `${plural(inventoryMovement.stockRequestsCreated, 'stock request')} raised and ${plural(inventoryMovement.transfersCompleted, 'transfer')} completed today.`,
      );
    }

    return paragraphs.join('\n\n');
  }
}
