import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { ExpenseFilter } from 'src/dtos/expense/expense.filter.dto';
import { ExpenseRequest } from 'src/dtos/expense/expense.request.dto';
import { ExpenseStatusRequest } from 'src/dtos/expense/expense.status.request.dto';
import { ExpenseTrend } from 'src/dtos/expense/expense.trend.dto';
import { ExpenseTrendFilter } from 'src/dtos/expense/expense.trend.filter.dto';
import { ExpenseStatus, ExpenseTrendGroupBy, LedgerSource } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { ExpenseRepository } from 'src/repositories/expense.repository';
import { ShopRepository } from 'src/repositories/shop.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { Expense } from 'src/schemas/expense.schema';
import { LedgerEntryService } from 'src/services/ledger-entry.service';
import {
  advanceDayWeekMonthBucket,
  dayWeekMonthBucketKey,
  resolveDayWeekMonthRange,
  resolveRequesterShopId,
  startOfDayWeekMonthBucket,
  toPaginationInfo,
  toShopInfo,
} from 'src/utils';

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);
  constructor(
    private readonly expenseRepository: ExpenseRepository,
    private readonly shopRepository: ShopRepository,
    private readonly ledgerEntryService: LedgerEntryService,
    private readonly userRepository: UserRepository,
  ) {}

  //get by id - a shop-scoped requester can't see another shop's expense,
  //nor a company-wide (shopId: null) one
  async getById(id: string, requesterId: string): Promise<ApiResponseDto<Expense>> {
    try {
      const expense = await this.expenseRepository.getById(id);
      if (!expense) {
        return CommonResponses.NotFoundResponse<Expense>('Expense not found');
      }
      const shopId = await resolveRequesterShopId(requesterId, this.userRepository);
      if (shopId && expense.shopId !== shopId) {
        return CommonResponses.NotFoundResponse<Expense>('Expense not found');
      }
      return CommonResponses.OkResponse<Expense>(expense);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting expense by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Expense>(
        'An error occurred while getting expense by id',
      );
    }
  }

  // Spending trend: value1 is total amount, value2 is number of expenses,
  // per bucket - every bucket in range appears even with no spending, so a
  // chart has no gaps.
  async getTrend(
    filter: ExpenseTrendFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<ExpenseTrend[]>> {
    try {
      const groupBy = filter?.groupBy ?? ExpenseTrendGroupBy.Day;
      const { start, end } = resolveDayWeekMonthRange(filter?.startDate, filter?.endDate, groupBy);
      const shopId = await resolveRequesterShopId(requesterId, this.userRepository);

      const rows = await this.expenseRepository.getTrend({
        ...filter,
        ...(shopId ? { shopId } : {}),
        groupBy,
        startDate: start,
        endDate: end,
      });

      const byKey = new Map(rows.map((row) => [row.key, row]));
      const trend: ExpenseTrend[] = [];
      const lastKey = dayWeekMonthBucketKey(end, groupBy);
      let cursor = startOfDayWeekMonthBucket(start, groupBy);
      for (let i = 0; i < 5000; i++) {
        const key = dayWeekMonthBucketKey(cursor, groupBy);
        const row = byKey.get(key);
        trend.push({ label: key, value1: row?.value1 ?? 0, value2: row?.value2 ?? 0 });
        if (key === lastKey) break;
        cursor = advanceDayWeekMonthBucket(cursor, groupBy);
      }

      return CommonResponses.OkResponse<ExpenseTrend[]>(trend);
    } catch (error) {
      this.logger.error('an error occurred while getting the expense trend', filter, error);
      return CommonResponses.InternalServerErrorResponse<ExpenseTrend[]>(
        'An error occurred while getting the expense trend',
      );
    }
  }

  //list, optionally scoped by shop/category/status - a shop-tied requester
  //is always forced to their own shop, regardless of what they ask for
  async list(
    filter: ExpenseFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<PagedResults<Expense>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const shopId = await resolveRequesterShopId(requesterId, this.userRepository);
      const scoped = shopId ? { ...filter, shopId } : filter;
      const { results, totalCount } = await this.expenseRepository.list(scoped);
      return CommonResponses.OkResponse<PagedResults<Expense>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing expenses',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<PagedResults<Expense>>(
        'An error occurred while listing expenses',
      );
    }
  }

  //record an expense
  async create(
    request: ExpenseRequest,
    recordedById: string,
  ): Promise<ApiResponseDto<Expense>> {
    try {
      let shopInfoSnapshot = undefined;
      if (request.shopId) {
        const shop = await this.shopRepository.getById(request.shopId);
        if (!shop) {
          return CommonResponses.NotFoundResponse<Expense>('Shop not found');
        }
        shopInfoSnapshot = toShopInfo(shop);
      }

      const expense = await this.expenseRepository.create({
        ...request,
        shopInfoSnapshot,
        recordedById,
      });

      // an expense only actually leaves the shop's cash once it's Paid
      if (expense.shopId && expense.status === ExpenseStatus.Paid) {
        await this.ledgerEntryService.debit(
          expense.shopId,
          expense.amount,
          LedgerSource.Expense,
          {
            referenceId: expense.id,
            description: expense.description,
            recordedById,
          },
        );
      }

      return CommonResponses.CreatedResponse<Expense>(expense);
    } catch (error) {
      this.logger.error(
        'an error occurred while recording expense',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Expense>(
        'An error occurred while recording expense',
      );
    }
  }

  //update expense - shopId is optional and re-resolved here every time, so
  //an edit can (re)assign the expense to a shop or clear it back to head
  //office, exactly as create() allows when first recording it
  async update(
    id: string,
    request: ExpenseRequest,
  ): Promise<ApiResponseDto<Expense>> {
    try {
      let shopInfoSnapshot = null;
      if (request.shopId) {
        const shop = await this.shopRepository.getById(request.shopId);
        if (!shop) {
          return CommonResponses.NotFoundResponse<Expense>('Shop not found');
        }
        shopInfoSnapshot = toShopInfo(shop);
      }

      const expense = await this.expenseRepository.update(id, {
        ...request,
        shopId: request.shopId ?? null,
        shopInfoSnapshot,
      });
      if (!expense) {
        return CommonResponses.NotFoundResponse<Expense>('Expense not found');
      }
      return CommonResponses.OkResponse<Expense>(expense);
    } catch (error) {
      this.logger.error(
        'an error occurred while updating expense',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Expense>(
        'An error occurred while updating expense',
      );
    }
  }

  //mark an expense paid/pending
  async updateStatus(
    id: string,
    request: ExpenseStatusRequest,
    reviewedById: string,
  ): Promise<ApiResponseDto<Expense>> {
    try {
      const before = await this.expenseRepository.getById(id);
      if (!before) {
        return CommonResponses.NotFoundResponse<Expense>('Expense not found');
      }

      const expense = await this.expenseRepository.updateStatus(
        id,
        request.status,
      );

      if (expense.shopId && before.status !== expense.status) {
        if (expense.status === ExpenseStatus.Paid) {
          await this.ledgerEntryService.debit(
            expense.shopId,
            expense.amount,
            LedgerSource.Expense,
            {
              referenceId: expense.id,
              description: expense.description,
              recordedById: reviewedById,
            },
          );
        } else if (before.status === ExpenseStatus.Paid) {
          await this.ledgerEntryService.credit(
            expense.shopId,
            expense.amount,
            LedgerSource.Expense,
            {
              referenceId: expense.id,
              description: `Reversal: ${expense.description}`,
              recordedById: reviewedById,
            },
          );
        }
      }

      return CommonResponses.OkResponse<Expense>(expense);
    } catch (error) {
      this.logger.error(
        'an error occurred while updating expense status',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Expense>(
        'An error occurred while updating expense status',
      );
    }
  }

  //delete expense
  async delete(id: string): Promise<ApiResponseDto<Expense>> {
    try {
      const expense = await this.expenseRepository.delete(id);
      if (!expense) {
        return CommonResponses.NotFoundResponse<Expense>('Expense not found');
      }
      return CommonResponses.OkResponse<Expense>(expense);
    } catch (error) {
      this.logger.error('an error occurred while deleting expense', id, error);
      return CommonResponses.InternalServerErrorResponse<Expense>(
        'An error occurred while deleting expense',
      );
    }
  }
}
