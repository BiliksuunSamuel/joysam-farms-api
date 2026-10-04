import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import {
  ExpenseCategory,
  ExpensePaymentMethod,
  ExpenseStatus,
} from 'src/enums';
import { ServiceInfo } from 'src/models/service/service-info.model';
import { ShopInfo } from 'src/models/shop/shop-info.model';

const ShopInfoSchema = SchemaFactory.createForClass(ShopInfo);
const ServiceInfoSchema = SchemaFactory.createForClass(ServiceInfo);

// An operating cost - rent, utilities, wages, etc. - company-wide or at a
// specific shop.
@Schema()
export class Expense extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  date: Date;

  @Prop({ required: true })
  @ApiProperty()
  description: string;

  @Prop({ type: String, enum: ExpenseCategory, required: true })
  @ApiProperty({ enum: ExpenseCategory })
  category: ExpenseCategory;

  // null = company-wide / head office, not tied to one shop.
  @Prop({ default: null })
  @ApiProperty()
  shopId: string;

  @Prop({ type: ShopInfoSchema, default: null })
  @ApiProperty({ type: ShopInfo })
  shopInfoSnapshot: ShopInfo;

  // Optionally tied to the service this expense was incurred for (e.g.
  // electricity for Grinding/Mixing) - null means not service-specific,
  // same convention as shopId/shopInfoSnapshot above.
  @Prop({ default: null })
  @ApiProperty()
  serviceId: string;

  @Prop({ type: ServiceInfoSchema, default: null })
  @ApiProperty({ type: ServiceInfo })
  serviceInfoSnapshot: ServiceInfo;

  @Prop({ required: true })
  @ApiProperty()
  payee: string;

  @Prop({ required: true })
  @ApiProperty()
  amount: number;

  @Prop({ type: String, enum: ExpensePaymentMethod, required: true })
  @ApiProperty({ enum: ExpensePaymentMethod })
  paymentMethod: ExpensePaymentMethod;

  @Prop({ type: String, enum: ExpenseStatus, default: ExpenseStatus.Pending })
  @ApiProperty({ enum: ExpenseStatus })
  status: ExpenseStatus;

  @Prop({ required: true })
  @ApiProperty()
  recordedById: string;
}
