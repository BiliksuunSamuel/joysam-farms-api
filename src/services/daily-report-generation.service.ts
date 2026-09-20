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
    return await this.dailyReportRepository.upsert(
      shopId,
      startOfUTCDay(date),
      {
        ...sections,
        shopInfoSnapshot: shop ? toShopInfo(shop) : null,
      },
    );
  }

  async generateOrgWide(date: Date): Promise<DailyReport> {
    const sections = await this.buildSections(undefined, date);
    return await this.dailyReportRepository.upsert(null, startOfUTCDay(date), {
      ...sections,
      shopInfoSnapshot: null,
    });
  }

  // shopId undefined = organisation-wide, for every underlying query.
  private async buildSections(
    shopId: string | undefined,
    date: Date,
  ): Promise<Omit<DailyReportSections, 'shopInfoSnapshot'>> {
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
}
