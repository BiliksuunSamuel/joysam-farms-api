import { Category } from 'src/schemas/category.schema';

// Inherits every Category field, so computed/derived information (once we
// need any) has somewhere to live without redeclaring the schema.
export class CategoryResponse extends Category {}
