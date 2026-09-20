import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PaymentTransactionRepository } from 'src/repositories/payment-transaction.repository';
import { SaleRepository } from 'src/repositories/sale.repository';
import { PaymentTransactionService } from 'src/services/payment-transaction.service';

const ABANDON_AFTER_MS = 30 * 60 * 1000;

// Catches Digital sales that never reach a terminal state via the webhook
// or the checkout confirmation page's poll - e.g. the customer closes the
// tab mid-payment. Reuses the same idempotent confirmDigitalPayment core,
// so this adds no new logic, just another caller of it.
@Injectable()
export class PaymentTransactionSweepService {
  private readonly logger = new Logger(PaymentTransactionSweepService.name);
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly paymentTransactionRepository: PaymentTransactionRepository,
    private readonly paymentTransactionService: PaymentTransactionService,
  ) {}

  @Cron('*/5 * * * *')
  async sweepStalePendingDigitalSales() {
    this.logger.log('starting sweep for stale pending digital sales');
    const stale = await this.saleRepository.findStalePendingDigital(
      new Date(Date.now() - ABANDON_AFTER_MS),
    );
    if (!stale.length) return;

    this.logger.log(`sweeping ${stale.length} stale pending digital sale(s)`);
    for (const sale of stale) {
      const txn = await this.paymentTransactionRepository.getBySaleId(sale.id);
      if (!txn) continue;
      await this.paymentTransactionService.confirmDigitalPayment(txn.reference);
    }
  }
}
