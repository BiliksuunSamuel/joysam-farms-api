import { ApiProperty } from '@nestjs/swagger';
import { InventoryResponse } from './inventory.response.dto';

export class BulkInventoryRowError {
  @ApiProperty()
  row: number;

  @ApiProperty()
  message: string;
}

export class BulkInventoryResult {
  @ApiProperty({ type: [InventoryResponse] })
  created: InventoryResponse[];

  @ApiProperty({ type: [BulkInventoryRowError] })
  errors: BulkInventoryRowError[];
}
