import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';

/**
 * A record of a significant action taken on the platform. `entityType` and
 * `action` are free-form strings ("Shop", "Created") rather than enums,
 * deliberately - every feature can post its own actions here without this
 * schema needing an edit every time a new one is added.
 */
@Schema()
export class AuditLog extends BaseSchema {
  @Prop({ required: true })
  @ApiProperty()
  entityType: string;

  // null for events with no single entity, e.g. a login.
  @Prop({ default: null })
  @ApiProperty()
  entityId: string;

  @Prop({ required: true })
  @ApiProperty()
  action: string;

  @Prop({ required: true })
  @ApiProperty()
  description: string;

  // null for system-generated or unauthenticated events (e.g. a login attempt).
  @Prop({ default: null })
  @ApiProperty()
  performedById: string;

  @Prop({ type: Object, default: null })
  @ApiProperty()
  metadata: Record<string, any>;

  @Prop({ default: null })
  @ApiProperty()
  ipAddress: string;

  @Prop({ default: null })
  @ApiProperty()
  agent: string;
}
