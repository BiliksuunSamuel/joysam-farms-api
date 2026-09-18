import { ApiProperty } from '@nestjs/swagger';

export class RecentSignInResponse {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  signedInAt: Date;

  @ApiProperty({ required: false })
  ipAddress: string | null;
}
