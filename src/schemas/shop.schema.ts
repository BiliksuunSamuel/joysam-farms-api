import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { ShopStatus, ShopType } from 'src/enums';
import { OperatingHour } from 'src/models/shop/operating-hour.model';

const OperatingHourSchema = SchemaFactory.createForClass(OperatingHour);

@Schema()
export class Shop extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  name: string;

  @Prop({ required: true })
  @ApiProperty()
  location: string;

  @Prop({ default: null })
  @ApiProperty()
  phone: string;

  // References a User (Employee) id. Kept loose (no ref/populate) - there's
  // no cross-collection integrity check, so this can point at a deleted or
  // reassigned employee.
  @Prop({ default: null })
  @ApiProperty()
  managerId: string;

  @Prop({ type: String, enum: ShopStatus, default: ShopStatus.Open })
  @ApiProperty({ enum: ShopStatus })
  status: ShopStatus;

  @Prop({ type: String, enum: ShopType, default: ShopType.GeneralStore })
  @ApiProperty({ enum: ShopType })
  type: ShopType;

  @Prop({ default: Date.now })
  @ApiProperty()
  openedAt: Date;

  @Prop({ type: [OperatingHourSchema], default: [] })
  @ApiProperty({ type: [OperatingHour] })
  operatingHours: OperatingHour[];

  // 0 = no target set - analytics treats that shop as having no pace to track.
  @Prop({ default: 0 })
  @ApiProperty()
  salesMonthTarget: number;

  @Prop({ default: null })
  @ApiProperty()
  receiptPrefix: string;

  // Whether this specific shop can process Credit-method sales at all -
  // checked in SaleService.create alongside VendorService.assertCanSellOnCredit,
  // which governs a given vendor's own eligibility. This is the coarser,
  // per-shop switch (e.g. a satellite kiosk with no one trained to manage a
  // vendor ledger).
  @Prop({ default: true })
  @ApiProperty()
  allowCreditSales: boolean;
}
