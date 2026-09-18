import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { StockRequestStatus } from 'src/enums';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { StockRequestItem } from 'src/models/stock-request/stock-request-item.model';

const ShopInfoSchema = SchemaFactory.createForClass(ShopInfo);
const StockRequestItemSchema = SchemaFactory.createForClass(StockRequestItem);

// A shop asking the warehouse for one or more items. Approving one creates
// and completes a Transfer (fromShopId null) per line, for its full
// requested quantity - there's no partial fulfilment: either every line has
// enough warehouse stock and the whole request is approved, or none of it
// is and the request stays Pending.
@Schema()
export class StockRequest extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  shopId: string;

  @Prop({ type: ShopInfoSchema, required: true })
  @ApiProperty({ type: ShopInfo })
  shopInfoSnapshot: ShopInfo;

  @Prop({ type: [StockRequestItemSchema], default: [] })
  @ApiProperty({ type: [StockRequestItem] })
  items: StockRequestItem[];

  @Prop({ enum: StockRequestStatus, default: StockRequestStatus.Pending })
  @ApiProperty({ enum: StockRequestStatus })
  status: StockRequestStatus;

  @Prop({ required: true })
  @ApiProperty()
  requestedById: string;

  @Prop({ default: null })
  @ApiProperty()
  reviewedById: string;

  @Prop({ default: null })
  @ApiProperty()
  notes: string;

  // Set once approved - one Transfer per line that fulfilled this request.
  @Prop({ default: [] })
  @ApiProperty()
  transferIds: string[];
}
