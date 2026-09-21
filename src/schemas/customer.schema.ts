import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';

// A retail customer captured at checkout (for any payment method, not just
// Credit - that's Vendor, a distinct concept for buyers billed on account).
// Found-or-created by phone at checkout time - see
// CustomerRepository.findOrCreateByPhone - so `phone` is the true identity
// here and is kept unique and normalized (see utils.normalizePhone).
@Schema()
export class Customer extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  name: string;

  @Prop({ required: true, unique: true })
  @ApiProperty()
  phone: string;
}
