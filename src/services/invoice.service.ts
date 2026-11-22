import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import { SettingsRepository } from 'src/repositories/settings.repository';
import { Sale } from 'src/schemas/sale.schema';
import { renderReceiptHtml } from 'src/templates/receipt.template';

// The downloadable receipt: the HTML template in src/templates is rendered to
// a PDF by headless Chromium (puppeteer), so restyling the receipt is just
// editing HTML/CSS. One browser is started on first use and reused. Set
// PUPPETEER_EXECUTABLE_PATH to use a system Chrome instead of the bundled one.
@Injectable()
export class InvoiceService implements OnModuleDestroy {
  private readonly logger = new Logger(InvoiceService.name);
  private browser: Promise<Browser> | null = null;

  constructor(private readonly settingsRepository: SettingsRepository) {}

  async onModuleDestroy() {
    if (this.browser) await (await this.browser).close().catch(() => undefined);
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = puppeteer
        .launch({
          headless: true,
          // containers usually run as root, where Chromium's sandbox can't start
          // (and /dev/shm is tiny there, so keep Chromium's scratch space off it)
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
        })
        .then((browser) => {
          browser.on('disconnected', () => (this.browser = null));
          return browser;
        })
        .catch((error) => {
          this.browser = null;
          throw error;
        });
    }
    return this.browser;
  }

  async buildSaleInvoice(sale: Sale): Promise<Buffer> {
    try {
      return await this.render(sale);
    } catch (error) {
      // A missing Chromium, a missing system library or an out-of-memory
      // kill all land here - log the real cause (the generic 500 hides it)
      // and answer with something a person can act on.
      this.logger.error(
        `could not render the receipt PDF for ${sale.receiptNo} - is Chromium installed (PUPPETEER_EXECUTABLE_PATH) and is there enough memory?`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'The receipt could not be created right now. Please try again, or print it from the sales screen.',
      );
    }
  }

  private async render(sale: Sale): Promise<Buffer> {
    const settings = await this.settingsRepository.get();
    const html = renderReceiptHtml(sale, settings);

    const page = await (await this.getBrowser()).newPage();
    try {
      // 'load' waits for the logo image too; a slow logo must not block the receipt
      await page
        .setContent(html, { waitUntil: 'load', timeout: 5000 })
        .catch((error) =>
          this.logger.warn(`receipt resources did not finish: ${String(error)}`),
        );
      const height = await page.evaluate(() => document.body.scrollHeight);
      const pdf = await page.pdf({
        width: '80mm',
        height: `${height + 4}px`,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        pageRanges: '1',
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }
}
