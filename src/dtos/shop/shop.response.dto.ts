import { ApiProperty } from '@nestjs/swagger';
import { OperatingTimeInfo } from 'src/models/shop/operating-time-info.model';
import { Shop } from 'src/schemas/shop.schema';

// Inherits every Shop field, so computed/derived information (like today's
// operatingTimeInfo) has somewhere to live without redeclaring the schema.
export class ShopResponse extends Shop {
  @ApiProperty({ type: OperatingTimeInfo })
  operatingTimeInfo: OperatingTimeInfo;

  @ApiProperty()
  nextReceiptNo: string;
}
