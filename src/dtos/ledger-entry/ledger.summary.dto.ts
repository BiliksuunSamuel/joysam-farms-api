// Available = the current live balance (credits minus debits - same
// number the wallet endpoint returns). Total inflow = every credit ever
// posted, any source. Total expenses = Expense-sourced debits net of any
// reversal credit - money that has actually left the wallet for expenses.
export class LedgerSummary {
  shopId: string;
  balance: number;
  totalInflow: number;
  totalExpenses: number;
}
