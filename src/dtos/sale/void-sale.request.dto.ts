import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoidSaleRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  reason: string;
}
