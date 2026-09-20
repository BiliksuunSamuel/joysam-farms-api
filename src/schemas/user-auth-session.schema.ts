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
  // the configured inactivity timeout (SESSION_TIMEOUT_MINUTES, not a fixed
  // expiry - the JWT itself already has one of those, signed with the same
  // value - see configuration/index.ts).
  @Prop({ default: Date.now })
  @ApiProperty()
  lastActiveAt: Date;

  // Recomputed as lastActiveAt + SESSION_TIMEOUT_MINUTES every time the
  // session is created or touched. AuthMiddleware already revokes a
  // stale session the moment it's used again, but if the browser never
  // makes another request (the frontend's own inactivity timer logs the
  // user out first, or the tab is just closed), nothing triggers that check.
  // This field lets UserAuthSessionSweepService find and revoke those rows
  // on a timer instead of waiting on a request that may never come.
  @Prop({ type: Date, default: null })
  @ApiProperty()
  expiresAt: Date | null;
}
