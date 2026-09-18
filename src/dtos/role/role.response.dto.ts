import { Role } from 'src/schemas/role.schema';

// Inherits every Role field, so computed/derived information has somewhere
// to live without redeclaring the schema.
export class RoleResponse extends Role {}
