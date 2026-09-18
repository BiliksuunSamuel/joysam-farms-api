import { ApiProperty } from '@nestjs/swagger';
import { Inventory } from 'src/schemas/inventory.schema';

// Inherits every Inventory field, so computed/derived information has
// somewhere to live without redeclaring the schema.
export class InventoryResponse extends Inventory {
  // A scannable EAN-13 rendering of `barcode`, computed at read time (never
  // persisted - it's fully derived from the stored barcode string).
  @ApiProperty()
  barcodeSvg: string;

  // Resolved live from categoryId on every read (never persisted), so it
  // always reflects the category's current name/description rather than a
  // stale snapshot from whenever the item was created.
  @ApiProperty()
  categoryName: string;

  @ApiProperty()
  categoryDescription: string | null;
}
