import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { LedgerAdjustmentRequest } from 'src/dtos/ledger-entry/ledger-adjustment.request.dto';
import { LedgerEntryFilter } from 'src/dtos/ledger-entry/ledger-entry.filter.dto';
import { LedgerSummary } from 'src/dtos/ledger-entry/ledger.summary.dto';
import { LedgerTrend } from 'src/dtos/ledger-entry/ledger.trend.dto';
import { LedgerTrendFilter } from 'src/dtos/ledger-entry/ledger.trend.filter.dto';
import { LedgerEntryType, LedgerSource, LedgerTrendGroupBy } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { LedgerEntryRepository } from 'src/repositories/ledger-entry.repository';
import { ShopRepository } from 'src/repositories/shop.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { LedgerEntry } from 'src/schemas/ledger-entry.schema';
import { WalletService } from 'src/services/wallet.service';
import {
  advanceDayWeekMonthBucket,
  dayWeekMonthBucketKey,
  resolveDayWeekMonthRange,
  resolveRequesterShopId,
  startOfDayWeekMonthBucket,
  toPaginationInfo,
} from 'src/utils';

type PostingOptions = {
  referenceId?: string;
  description?: string;
  recordedById?: string;
};

@Injectable()
export class LedgerEntryService {
  private readonly logger = new Logger(LedgerEntryService.name);
  constructor(
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly walletService: WalletService,
    private readonly shopRepository: ShopRepository,
    private readonly userRepository: UserRepository,
  ) {}

  //get by id
  async getById(
    id: string,
    requesterId: string,
  ): Promise<ApiResponseDto<LedgerEntry>> {
    try {
      const entry = await this.ledgerEntryRepository.getById(id);
      if (!entry) {
        return CommonResponses.NotFoundResponse<LedgerEntry>(
          'Ledger entry not found',
        );
      }
      const shopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );
      if (shopId && entry.shopId !== shopId) {
        return CommonResponses.NotFoundResponse<LedgerEntry>(
          'Ledger entry not found',
        );
      }
      return CommonResponses.OkResponse<LedgerEntry>(entry);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting ledger entry by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<LedgerEntry>(
        'An error occurred while getting ledger entry by id',
      );
    }
  }

  //list, optionally scoped by shop/wallet/type/source - a shop-tied
  //requester is always forced to their own shop
  async list(
    filter: LedgerEntryFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<PagedResults<LedgerEntry>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const shopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );
      const scoped = shopId ? { ...filter, shopId } : filter;
      const { results, totalCount } =
        await this.ledgerEntryRepository.list(scoped);
      return CommonResponses.OkResponse<PagedResults<LedgerEntry>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing ledger entries',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<LedgerEntry>
      >('An error occurred while listing ledger entries');
    }
  }

  // Cash flow trend for a shop's wallet: value1 is inflow (credits), value2
  // is outflow (debits) per bucket - every bucket in range appears even
  // with no activity, so a chart has no gaps.
  async getTrend(
    filter: LedgerTrendFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<LedgerTrend[]>> {
    try {
      const groupBy = filter?.groupBy ?? LedgerTrendGroupBy.Day;
      const { start, end } = resolveDayWeekMonthRange(
        filter?.startDate,
        filter?.endDate,
        groupBy,
      );
      const shopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );

      const rows = await this.ledgerEntryRepository.getTrend({
        ...filter,
        ...(shopId ? { shopId } : {}),
        groupBy,
        startDate: start,
        endDate: end,
      });

      const byKey = new Map(rows.map((row) => [row.key, row]));
      const trend: LedgerTrend[] = [];
      const lastKey = dayWeekMonthBucketKey(end, groupBy);
      let cursor = startOfDayWeekMonthBucket(start, groupBy);
      for (let i = 0; i < 5000; i++) {
        const key = dayWeekMonthBucketKey(cursor, groupBy);
        const row = byKey.get(key);
        trend.push({
          label: key,
          value1: row?.value1 ?? 0,
          value2: row?.value2 ?? 0,
        });
        if (key === lastKey) break;
        cursor = advanceDayWeekMonthBucket(cursor, groupBy);
      }

      return CommonResponses.OkResponse<LedgerTrend[]>(trend);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting the ledger trend',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<LedgerTrend[]>(
        'An error occurred while getting the ledger trend',
      );
    }
  }

  // All-time summary for one shop's wallet - a shop-tied requester is
  // always forced to their own shop, same as list()/getTrend().
  async getSummary(
    shopId: string,
    requesterId: string,
  ): Promise<ApiResponseDto<LedgerSummary>> {
    try {
      const ownShopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );
      const scopedShopId = ownShopId ?? shopId;
      if (!scopedShopId) {
        return CommonResponses.BadRequestResponse<LedgerSummary>(
          undefined,
          'A shop is required',
        );
      }

      const wallet = await this.walletService.getForShop(scopedShopId);
      if (!wallet.data) {
        return CommonResponses.NotFoundResponse<LedgerSummary>(
          'Shop not found',
        );
      }

      const { totalInflow, totalExpenses } =
        await this.ledgerEntryRepository.getShopTotals(scopedShopId);

      return CommonResponses.OkResponse<LedgerSummary>({
        shopId: scopedShopId,
        balance: wallet.data.balance,
        totalInflow,
        totalExpenses,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while getting the ledger summary',
        shopId,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<LedgerSummary>(
        'An error occurred while getting the ledger summary',
      );
    }
  }

  /**
   * Internal API for other features (Expense today, Sale once it exists) to
   * post to a shop's ledger. Assumes the caller has already validated the
   * shop exists - these are lean, not HTTP-response-shaped.
   */
  async credit(
    shopId: string,
    amount: number,
    source: LedgerSource,
    options?: PostingOptions,
  ): Promise<LedgerEntry> {
    return this.post(shopId, LedgerEntryType.Credit, amount, source, options);
  }

  async debit(
    shopId: string,
    amount: number,
    source: LedgerSource,
    options?: PostingOptions,
  ): Promise<LedgerEntry> {
    return this.post(shopId, LedgerEntryType.Debit, amount, source, options);
  }

  //a manual correction - the only way to post a ledger entry directly via the API
  async adjust(
    request: LedgerAdjustmentRequest,
    recordedById: string,
  ): Promise<ApiResponseDto<LedgerEntry>> {
    try {
      const shop = await this.shopRepository.getById(request.shopId);
      if (!shop) {
        return CommonResponses.NotFoundResponse<LedgerEntry>('Shop not found');
      }

      const postOptions = { description: request.description, recordedById };
      const entry =
        request.type === LedgerEntryType.Credit
          ? await this.credit(
              request.shopId,
              request.amount,
              LedgerSource.Adjustment,
              postOptions,
            )
          : await this.debit(
              request.shopId,
              request.amount,
              LedgerSource.Adjustment,
              postOptions,
            );
      return CommonResponses.CreatedResponse<LedgerEntry>(entry);
    } catch (error) {
      this.logger.error(
        'an error occurred while posting a ledger adjustment',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<LedgerEntry>(
        'An error occurred while posting a ledger adjustment',
      );
    }
  }

  private async post(
    shopId: string,
    type: LedgerEntryType,
    amount: number,
    source: LedgerSource,
    options?: PostingOptions,
  ): Promise<LedgerEntry> {
    const wallet = await this.walletService.getOrCreateWallet(shopId);
    const currentBalance = await this.ledgerEntryRepository.getBalance(
      wallet.id,
    );
    const balanceAfter =
      type === LedgerEntryType.Credit
        ? currentBalance + amount
        : currentBalance - amount;

    return await this.ledgerEntryRepository.create({
      walletId: wallet.id,
      shopId,
      type,
      source,
      referenceId: options?.referenceId,
      amount,
      balanceAfter,
      description: options?.description,
      recordedById: options?.recordedById,
    });
  }
}
