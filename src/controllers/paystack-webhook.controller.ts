import { Controller, Logger, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import configuration from 'src/configuration';
import { PaymentTransactionService } from 'src/services/payment-transaction.service';

// Public, unauthenticated - Paystack calls this directly, so it
// deliberately has no @AuthPermissions/@UseGuards. Trust is established
// entirely by the signature check below, not by anything the auth
// middleware does (see AppModule.configure - its .exclude() list doesn't
// gate access here either way, it's just hygiene). Raw body access for
// this one path is wired up in main.ts, ahead of the app's global JSON
// body parser.
@Controller('api/payments/paystack')
@ApiExcludeController()
export class PaystackWebhookController {
  private readonly logger = new Logger(PaystackWebhookController.name);
  constructor(
    private readonly paymentTransactionService: PaymentTransactionService,
  ) {}

  @Post('webhook')
  async handleWebhook(@Req() request: Request, @Res() response: Response) {
    const raw = request.body as Buffer;
    const signature = request.headers['x-paystack-signature'] as
      | string
      | undefined;

    if (
      !signature ||
      !Buffer.isBuffer(raw) ||
      !this.isValidSignature(raw, signature)
    ) {
      this.logger.warn(
        'rejected a paystack webhook with an invalid or missing signature',
      );
      response.status(401).send();
      return;
    }

    try {
      const payload = JSON.parse(raw.toString('utf8'));
      const reference = payload?.data?.reference;
      if (reference) {
        // The verify call inside this is the actual source of truth - no
        // need to branch on payload.event first.
        await this.paymentTransactionService.confirmDigitalPayment(reference);
      }
    } catch (error) {
      // Don't let a transient error (e.g. Paystack's own verify endpoint
      // blipping) turn into a non-200, which would trigger Paystack's
      // retry storm over something that isn't actually our problem to
      // signal back as a delivery failure.
      this.logger.error(
        'an error occurred while handling a paystack webhook',
        error,
      );
    }

    response.status(200).send();
  }

  private isValidSignature(raw: Buffer, signature: string): boolean {
    const expected = createHmac('sha512', configuration().paystack.key)
      .update(raw)
      .digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');
    if (expectedBuffer.length !== signatureBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, signatureBuffer);
  }
}
