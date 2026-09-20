import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { DailyReportFilter } from 'src/dtos/daily-report/daily-report.filter.dto';
import { DailyReportGenerateRequest } from 'src/dtos/daily-report/daily-report.generate.request.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { DailyReportRepository } from 'src/repositories/daily-report.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { DailyReport } from 'src/schemas/daily-report.schema';
import { DailyReportGenerationService } from 'src/services/daily-report-generation.service';
import {
  resolveRequesterShopId,
  startOfUTCDay,
  toPaginationInfo,
} from 'src/utils';

@Injectable()
export class DailyReportService {
  private readonly logger = new Logger(DailyReportService.name);
  constructor(
    private readonly dailyReportRepository: DailyReportRepository,
    private readonly dailyReportGenerationService: DailyReportGenerationService,
    private readonly userRepository: UserRepository,
  ) {}

  //list, optionally scoped by shop - a shop-tied requester is always forced
  //to their own shop, same as ExpenseService.list, and can never see the
  //organisation-wide rollup.
  async list(
    filter: DailyReportFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<PagedResults<DailyReport>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const shopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );
      const scoped = shopId ? { ...filter, shopId } : filter;
      const { results, totalCount } =
        await this.dailyReportRepository.list(scoped);
      return CommonResponses.OkResponse<PagedResults<DailyReport>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing daily reports',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<DailyReport>
      >('An error occurred while listing daily reports');
    }
  }

  async getForShop(
    shopId: string,
    date: string,
    requesterId: string,
  ): Promise<ApiResponseDto<DailyReport>> {
    try {
      const requesterShopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );
      if (requesterShopId && requesterShopId !== shopId) {
        return CommonResponses.NotFoundResponse<DailyReport>(
          'Daily report not found',
        );
      }
      const report = await this.dailyReportRepository.getByShopAndDate(
        shopId,
        startOfUTCDay(new Date(date)),
      );
      if (!report) {
        return CommonResponses.NotFoundResponse<DailyReport>(
          'Daily report not found',
        );
      }
      return CommonResponses.OkResponse<DailyReport>(report);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting a shop daily report',
        shopId,
        date,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<DailyReport>(
        'An error occurred while getting this daily report',
      );
    }
  }

  //the organisation-wide rollup - a shop-scoped requester can never see it
  async getOrgWide(
    date: string,
    requesterId: string,
  ): Promise<ApiResponseDto<DailyReport>> {
    try {
      const requesterShopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );
      if (requesterShopId) {
        return CommonResponses.NotFoundResponse<DailyReport>(
          'Daily report not found',
        );
      }
      const report = await this.dailyReportRepository.getByShopAndDate(
        null,
        startOfUTCDay(new Date(date)),
      );
      if (!report) {
        return CommonResponses.NotFoundResponse<DailyReport>(
          'Daily report not found',
        );
      }
      return CommonResponses.OkResponse<DailyReport>(report);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting the org-wide daily report',
        date,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<DailyReport>(
        'An error occurred while getting this daily report',
      );
    }
  }

  //manually (re)generate a report - a shop-scoped requester can only ever
  //regenerate their own shop's report, never another shop's or the
  //organisation-wide rollup.
  async generate(
    request: DailyReportGenerateRequest,
    requesterId: string,
  ): Promise<ApiResponseDto<DailyReport>> {
    try {
      const requesterShopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );
      if (requesterShopId && requesterShopId !== request.shopId) {
        return CommonResponses.ForbiddenResponse<DailyReport>(
          'You can only regenerate your own shop’s daily report',
        );
      }

      const date = startOfUTCDay(new Date(request.date));
      const report = request.shopId
        ? await this.dailyReportGenerationService.generateForShop(
            request.shopId,
            date,
          )
        : await this.dailyReportGenerationService.generateOrgWide(date);
      return CommonResponses.OkResponse<DailyReport>(report);
    } catch (error) {
      this.logger.error(
        'an error occurred while generating a daily report',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<DailyReport>(
        'An error occurred while generating this daily report',
      );
    }
  }
}
