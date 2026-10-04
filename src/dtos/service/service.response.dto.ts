import { Service } from 'src/schemas/service.schema';

// Inherits every Service field, so computed/derived information (once we
// need any) has somewhere to live without redeclaring the schema.
export class ServiceResponse extends Service {}
