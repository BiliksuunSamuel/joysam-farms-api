import { ApiProperty } from '@nestjs/swagger';
import { UserAuthSessionStatus } from 'src/enums';

export class RecentSignInResponse {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  signedInAt: Date;

  @ApiProperty({ required: false })
  ipAddress: string | null;

  @ApiProperty({ enum: UserAuthSessionStatus })
  status: UserAuthSessionStatus;
}
