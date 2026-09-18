import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

// A denormalised snapshot of a Vendor, embedded on documents that reference
// one (alongside a vendorId) so reads don't need a live lookup and history
// stays accurate even if the vendor's own record changes later.
//
// @Schema() is required here even though this is never a top-level
// collection - NestJS's SchemaFactory.createForClass() only discovers
// @Prop() fields on classes decorated with @Schema(); without it the
// embedded sub-document silently saves as empty (just an auto _id).
// _id: false since this already has its own app-level `id`.
@Schema({ _id: false })
export class VendorInfo {
  @Prop({ required: true })
  @ApiProperty()
  id: string;

  @Prop({ required: true })
  @ApiProperty()
  name: string;

  @Prop({ default: null })
  @ApiProperty()
  contactName: string;
}
