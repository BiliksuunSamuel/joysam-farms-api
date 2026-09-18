import { SupplyRequest } from 'src/schemas/supply-request.schema';

// Inherits every SupplyRequest field, so computed/derived information has
// somewhere to live without redeclaring the schema.
export class SupplyRequestResponse extends SupplyRequest {}
