import { StockRequest } from 'src/schemas/stock-request.schema';

// Inherits every StockRequest field, so computed/derived information has
// somewhere to live without redeclaring the schema.
export class StockRequestResponse extends StockRequest {}
