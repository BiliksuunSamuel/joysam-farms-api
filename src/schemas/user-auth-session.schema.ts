import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import { UserAuthSessionStatus } from 'src/enums';

// One document per login. Logging out (or revoking a device) sets status to
// Revoked rather than deleting the row, so a user's session history stays
// intact for auditing/"active devices" purposes.
@Schema()
export class UserAuthSession extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  userId: string;

  // The value embedded in the JWT's `tokenId` claim and checked on every
  // authenticated request.
  @Prop({ required: true })
  @ApiProperty()
  tokenId: string;

  @Prop({ default: null })
  @ApiProperty()
  ipAddress: string;

  // The requesting client's User-Agent header.
  @Prop({ default: null })
  @ApiProperty()
  agent: string;

  @Prop({
    type: String,
    enum: UserAuthSessionStatus,
    default: UserAuthSessionStatus.Active,
  })
  @ApiProperty({ enum: UserAuthSessionStatus })
  status: UserAuthSessionStatus;

  // Touched on every authenticated request so AuthMiddleware can enforce
  // Settings.sessionTimeoutMinutes (an inactivity timeout, not a fixed
  // expiry - the JWT itself already has one of those).
  @Prop({ default: Date.now })
  @ApiProperty()
  lastActiveAt: Date;
}
