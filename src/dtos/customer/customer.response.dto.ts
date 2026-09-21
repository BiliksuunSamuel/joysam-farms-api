import { Customer } from 'src/schemas/customer.schema';

// Inherits every Customer field, so computed/derived information (once we
// need any) has somewhere to live without redeclaring the schema.
export class CustomerResponse extends Customer {}
