import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';

// Login/auth details for a user, kept off the User schema itself.
// One-to-one with User via userId.
@Schema()
export class UserAuth extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  userId: string;

  // Denormalised so login can look up credentials by username in one query,
  // without going through User first. Immutable once set, so unlike the old
  // email field this never needs to be kept in sync with User.
  @Prop({ required: true, unique: true })
  @ApiProperty()
  username: string;

  @Prop({ required: true })
  @ApiProperty()
  password: string;

  // Set when a Super Manager resets this user's password and
  // Settings.forcePasswordChangeOnReset is on - cleared once they
  // successfully change it themselves via the self-service endpoint.
  @Prop({ default: false })
  @ApiProperty()
  mustChangePassword: boolean;
}
