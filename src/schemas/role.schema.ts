import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';

/**
 * A role is just a job-title label a user can be given - it carries no
 * permissions of its own. What a user can actually do is governed by the
 * permissionKeys/allPermissions set directly on that user (see the User
 * schema); every authorization check goes through those, never the role.
 */
@Schema()
export class Role extends BaseSchema {
  @Prop({ required: true, unique: true })
  @ApiProperty()
  name: string;

  @Prop({ default: null })
  @ApiProperty()
  description: string;
}
