// value1 = count of all transactions in the bucket (volume), value2 = how
// many of those succeeded - lets the UI chart both volume and a derived
// success rate (value2/value1) over time.
export class PaymentTransactionTrend {
  label: string;
  value1: number;
  value2: number;
}
