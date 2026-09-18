import { ShopInventory } from 'src/schemas/shop-inventory.schema';

// Inherits every ShopInventory field, so computed/derived information (once
// we need any) has somewhere to live without redeclaring the schema.
export class ShopInventoryResponse extends ShopInventory {}
