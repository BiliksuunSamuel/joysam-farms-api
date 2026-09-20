import { Injectable, Logger } from '@nestjs/common';
import { isAxiosError } from 'axios';
import configuration from 'src/configuration';
import { ProxyHttpService } from './proxy-http.service';
import { PaystackTransactionInitializationResponse } from 'src/dtos/paystack/paystack.transaction.initialization.response';
import {
  PaystackTransactionVerificationResponse,
  PaystackVerifyResponseData,
} from 'src/dtos/paystack/paystack.transaction.verification.response';

export type InitiateTransactionParams = {
  reference: string;
  amountGhs: number;
  email: string;
  callbackUrl: string;
};

// Paystack's own signal that a reference was never a real transaction on
// this integration (e.g. initialize was never actually called/succeeded,
// but a local Pending sale + PaymentTransaction were still created) - this
// is permanent, unlike a network blip or a 5xx, so callers should void
// rather than keep retrying forever.
export class PaystackReferenceNotFoundError extends Error {
  constructor(reference: string) {
    super(`Paystack has no transaction for reference ${reference}`);
    this.name = 'PaystackReferenceNotFoundError';
  }
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  constructor(private readonly proxyHttpService: ProxyHttpService) {}

  //start a Paystack transaction - returns the hosted checkout URL to
  //redirect the customer to. Amount is GHS on the way in; Paystack expects
  //the smallest currency unit (pesewas) - converted only here, via
  //configuration().paystack.amountMultiplier (100 in production, see that
  //config for why it's env-driven rather than hardcoded).
  async initiateTransaction(
    params: InitiateTransactionParams,
  ): Promise<PaystackTransactionInitializationResponse | null> {
    try {
      const url = `${configuration().paystack.url}/transaction/initialize`;

      const res =
        await this.proxyHttpService.request<PaystackTransactionInitializationResponse>(
          {
            method: 'post',
            url,
            token: configuration().paystack.key,
            data: {
              email: params.email,
              reference: params.reference,
              amount: Math.round(
                params.amountGhs * configuration().paystack.amountMultiplier,
              ),
              callback_url: params.callbackUrl,
            },
          },
        );
      this.logger.debug('response from paystack initialize', res);
      return res;
    } catch (error) {
      this.logger.error(
        'an error occurred while initiating a paystack transaction',
        params,
        error,
      );
      return null;
    }
  }

  //verify a transaction's current status directly with Paystack - the
  //source of truth used by PaymentTransactionService.confirmDigitalPayment
  //regardless of what triggered the check (webhook, poll, or the
  //abandonment sweep). Never trust a webhook payload alone.
  async checkStatus(
    reference: string,
  ): Promise<PaystackVerifyResponseData | null> {
    try {
      const url = `${configuration().paystack.url}/transaction/verify/${encodeURIComponent(reference)}`;

      const res =
        await this.proxyHttpService.request<PaystackTransactionVerificationResponse>(
          {
            method: 'get',
            url,
            token: configuration().paystack.key,
          },
        );
      this.logger.debug('response from paystack verify', res);
      return res.data;
    } catch (error) {
      if (
        isAxiosError(error) &&
        error.response?.status === 400 &&
        (error.response?.data as { code?: string } | undefined)?.code ===
          'transaction_not_found'
      ) {
        throw new PaystackReferenceNotFoundError(reference);
      }
      this.logger.error(
        'an error occurred while checking a paystack transaction status',
        reference,
        error,
      );
      return null;
    }
  }

  //fetch a transaction directly by Paystack's own numeric id, rather than
  //by our reference - the id only becomes known after a first verify (see
  //PaymentTransaction.paystackTransactionId), so this is for re-fetching
  //full details later (e.g. a reconciliation/support lookup), not part of
  //the checkout confirmation flow itself.
  async getTransaction(
    paystackTransactionId: number,
  ): Promise<PaystackVerifyResponseData | null> {
    try {
      const url = `${configuration().paystack.url}/transaction/${paystackTransactionId}`;

      const res =
        await this.proxyHttpService.request<PaystackTransactionVerificationResponse>(
          {
            method: 'get',
            url,
            token: configuration().paystack.key,
          },
        );
      this.logger.debug('response from paystack get transaction', res);
      return res.data;
    } catch (error) {
      this.logger.error(
        'an error occurred while fetching a paystack transaction',
        paystackTransactionId,
        error,
      );
      return null;
    }
  }
}
