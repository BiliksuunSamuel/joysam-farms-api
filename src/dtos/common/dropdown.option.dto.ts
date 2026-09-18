import { ApiProperty } from '@nestjs/swagger';

// A minimal {id, name} pair - the shape every dropdown endpoint returns,
// regardless of how much detail the underlying resource actually has.
export class DropdownOption {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}
