import { Expense } from 'src/schemas/expense.schema';

// Inherits every Expense field, so computed/derived information has
// somewhere to live without redeclaring the schema.
export class ExpenseResponse extends Expense {}
