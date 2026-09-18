import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// Used for both approve and reject - notes is optional either way (e.g. a
// rejection reason), so one DTO covers both actions.
export class SupplyRequestReview {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
