import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseSchema } from '.';
import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from 'src/enums';
import { ShopInfo } from 'src/models/shop/shop-info.model';

const ShopInfoSchema = SchemaFactory.createForClass(ShopInfo);

@Schema()
export class User extends BaseSchema {
  @Prop()
  @ApiProperty()
  name: string;

  @Prop()
  @ApiProperty()
  email: string;

  @Prop({ required: true })
  @ApiProperty()
  phone: string;

  // A job-title label only - carries no permissions of its own. What this
  // user can actually do is governed entirely by permissionKeys/
  // allPermissions below.
  @Prop({ default: null })
  @ApiProperty()
  roleId: string;

  @Prop({ enum: UserStatus, default: UserStatus.Active })
  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  // null = not tied to a shop (e.g. a super manager at head office).
  @Prop({ default: null })
  @ApiProperty()
  shopId: string;

  @Prop({ type: ShopInfoSchema, default: null })
  @ApiProperty({ type: ShopInfo })
  shopInfoSnapshot: ShopInfo;

  @Prop({ default: [] })
  @ApiProperty()
  permissionKeys: string[];

  // Grants every permission, present and future - permissionKeys is ignored
  // when this is true. There must always be at least one active user with
  // this set, so the platform owner always has a way in.
  @Prop({ default: false })
  @ApiProperty()
  allPermissions: boolean;
}
