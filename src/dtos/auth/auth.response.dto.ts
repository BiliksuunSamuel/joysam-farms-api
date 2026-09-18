import { ApiProperty } from '@nestjs/swagger';
import { UserResponse } from '../user/user.response.dto';

export class AuthResponse {
  @ApiProperty()
  user: UserResponse;
  @ApiProperty()
  token: string;
  // True when a Super Manager reset this password and
  // Settings.forcePasswordChangeOnReset was on at the time - the client
  // blocks the dashboard behind a change-password screen until it's cleared.
  @ApiProperty()
  mustChangePassword: boolean;
}
