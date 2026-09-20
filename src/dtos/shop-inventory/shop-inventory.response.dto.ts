import { ApiProperty } from '@nestjs/swagger';
import { StockHealth } from 'src/services/inventory-utils.service';
import { ShopInventory } from 'src/schemas/shop-inventory.schema';

// Inherits every ShopInventory field, so computed/derived information has
// somewhere to live without redeclaring the schema.
export class ShopInventoryResponse extends ShopInventory {
  // Computed from Settings.lowStockThresholdMode at read time (never
  // persisted) - see InventoryUtilsService.computeStockHealth. FixedQuantity
  // mode falls back to the warehouse item's own reorderLevel, resolved live
  // since ShopInventory itself carries no reorder threshold.
  @ApiProperty()
  stockHealth: StockHealth;

  // Only set in DaysOfCover mode with recent sales at this shop to project
  // from - null otherwise.
  @ApiProperty()
  daysOfCover: number | null;
}
