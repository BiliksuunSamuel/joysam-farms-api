import { LedgerEntry } from 'src/schemas/ledger-entry.schema';

// Inherits every LedgerEntry field, so computed/derived information has
// somewhere to live without redeclaring the schema.
export class LedgerEntryResponse extends LedgerEntry {}
