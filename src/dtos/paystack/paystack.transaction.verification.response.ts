export type PaystackVerifyStatus =
  | 'success'
  | 'failed'
  | 'abandoned'
  | 'pending';

// Card fields (bin/last4/brand) are always present but only meaningful for
// the card channel; for mobile_money, `bank` carries the network name (e.g.
// "MTN") and `mobile_money_number` the buyer's number - that's the actual
// number the cashier/buyer entered on Paystack's own checkout page, which
// this app never captures itself.
export class PaystackAuthorizationData {
  authorization_code: string | null;
  bin: string | null;
  last4: string | null;
  exp_month: string | null;
  exp_year: string | null;
  channel: string | null;
  card_type: string | null;
  bank: string | null;
  country_code: string | null;
  brand: string | null;
  reusable: boolean;
  signature: string | null;
  account_name: string | null;
  mobile_money_number: string | null;
  receiver_bank_account_number: string | null;
  receiver_bank: string | null;
}

export class PaystackCustomerData {
  id: number;
  email: string;
  customer_code: string;
  phone: string | null;
}

// One entry of the attempt history Paystack tracks on its own checkout
// page - e.g. "Attempted to pay with mobile money" - useful for
// understanding why a payment failed without needing to ask the cashier.
export class PaystackLogHistoryEntry {
  type: string;
  message: string;
  time: number;
}

export class PaystackLogData {
  start_time: number;
  time_spent: number;
  attempts: number;
  errors: number;
  success: boolean;
  history: PaystackLogHistoryEntry[];
}

export class PaystackVerifyResponseData {
  id: number;
  domain: string;
  status: PaystackVerifyStatus;
  reference: string;
  amount: number;
  currency: string;
  gateway_response: string;
  paid_at: string | null;
  created_at: string;
  channel: string | null;
  ip_address: string | null;
  fees: number | null;
  authorization: PaystackAuthorizationData | null;
  customer: PaystackCustomerData | null;
  log: PaystackLogData | null;
}

export class PaystackTransactionVerificationResponse {
  status: boolean;
  message: string;
  data: PaystackVerifyResponseData;
}
