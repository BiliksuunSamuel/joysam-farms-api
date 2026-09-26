import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { ProfitAndLossResponse } from 'src/dtos/sale/profit-and-loss.response.dto';
import { SaleFilter } from 'src/dtos/sale/sale.filter.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { SaleProfitItem } from 'src/models/sale/sale-profit-item.model';
import { SaleProfitRepository } from 'src/repositories/sale-profit.repository';

@Injectable()
export class SaleProfitService {
  private readonly logger = new Logger(SaleProfitService.name);
  constructor(private readonly saleProfitRepository: SaleProfitRepository) {}

  // Internal API for SaleService.create() - called once per sale, right
  // after it's created. Never HTTP-response-shaped, same convention as
  // SupplierService.postBill.
  async record(entry: {
    saleId: string;
    shopId: string;
    date: Date;
    items: SaleProfitItem[];
    revenue: number;
    cost: number;
    profit: number;
  }): Promise<void> {
    await this.saleProfitRepository.create(entry);
  }

  async getProfitAndLoss(
    filter: SaleFilter,
  ): Promise<ApiResponseDto<ProfitAndLossResponse>> {
    try {
      const { revenue, cost, profit } =
        await this.saleProfitRepository.getSummary(filter);
      return CommonResponses.OkResponse<ProfitAndLossResponse>({
        revenue,
        cost,
        profit,
        marginPercent: revenue > 0 ? (profit / revenue) * 100 : 0,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while getting profit and loss',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<ProfitAndLossResponse>(
        'An error occurred while getting profit and loss',
      );
    }
  }
}
