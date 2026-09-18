import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { TransferStatus } from 'src/enums';
import { InventoryInfo } from 'src/models/inventory/inventory-info.model';
import { ShopInfo } from 'src/models/shop/shop-info.model';

const ShopInfoSchema = SchemaFactory.createForClass(ShopInfo);
const InventoryInfoSchema = SchemaFactory.createForClass(InventoryInfo);

// A movement of an inventory item's quantity from one location to a shop.
// fromShopId null = the central warehouse ("stocking a shop"); a real shop
// id = a shop-to-shop transfer. Either way the destination is always a shop.
@Schema()
export class Transfer extends BaseSchema {
  @Prop({ default: null })
  @ApiProperty()
  fromShopId: string;

  @Prop({ type: ShopInfoSchema, default: null })
  @ApiProperty({ type: ShopInfo })
  fromShopInfoSnapshot: ShopInfo;

  @Prop({ required: true })
  @ApiProperty()
  toShopId: string;

  @Prop({ type: ShopInfoSchema, required: true })
  @ApiProperty({ type: ShopInfo })
  toShopInfoSnapshot: ShopInfo;

  @Prop({ required: true })
  @ApiProperty()
  inventoryId: string;

  @Prop({ type: InventoryInfoSchema, required: true })
  @ApiProperty({ type: InventoryInfo })
  inventoryInfoSnapshot: InventoryInfo;

  @Prop({ required: true })
  @ApiProperty()
  quantity: number;

  @Prop({ enum: TransferStatus, default: TransferStatus.Pending })
  @ApiProperty({ enum: TransferStatus })
  status: TransferStatus;

  @Prop({ required: true })
  @ApiProperty()
  initiatedById: string;

  @Prop({ default: null })
  @ApiProperty()
  approvedById: string;
}
