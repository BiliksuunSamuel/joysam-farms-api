import { Transfer } from 'src/schemas/transfer.schema';

// Inherits every Transfer field, so computed/derived information has
// somewhere to live without redeclaring the schema.
export class TransferResponse extends Transfer {}
