import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

// A denormalised snapshot of a User, embedded on documents that reference
// one (alongside a userId) so reads don't need a live lookup and history
// stays accurate even if the user's own record changes later.
//
// @Schema() is required here even though this is never a top-level
// collection - NestJS's SchemaFactory.createForClass() only discovers
// @Prop() fields on classes decorated with @Schema(); without it the
// embedded sub-document silently saves as empty (just an auto _id).
// _id: false since this already has its own app-level `id`.
@Schema({ _id: false })
export class UserInfo {
  @Prop({ required: true })
  @ApiProperty()
  id: string;

  @Prop({ required: true })
  @ApiProperty()
  name: string;

  @Prop({ default: null })
  @ApiProperty()
  email: string;

  @Prop({ default: null })
  @ApiProperty()
  phone: string;

  // The role's name at the time of the snapshot - display only. Never used
  // for authorization, which always resolves the user's current roleId live.
  @Prop({ default: null })
  @ApiProperty()
  roleName: string;
}
