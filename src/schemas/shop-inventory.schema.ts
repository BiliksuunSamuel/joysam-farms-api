import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { ShopInventoryStatus } from 'src/enums';
import { InventoryInfo } from 'src/models/inventory/inventory-info.model';

const InventoryInfoSchema = SchemaFactory.createForClass(InventoryInfo);

// An inventory item assigned to a shop, and how much of it is there.
@Schema()
export class ShopInventory extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  shopId: string;

  @Prop({ required: true })
  @ApiProperty()
  inventoryId: string;

  @Prop({ type: InventoryInfoSchema, default: null })
  @ApiProperty({ type: InventoryInfo })
  inventoryInfoSnapshot: InventoryInfo;

  @Prop({ default: 0 })
  @ApiProperty()
  quantity: number;

  @Prop({
    type: String,
    enum: ShopInventoryStatus,
    default: ShopInventoryStatus.Available,
  })
  @ApiProperty({ enum: ShopInventoryStatus })
  status: ShopInventoryStatus;
}
