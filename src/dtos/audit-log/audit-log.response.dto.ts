import { ApiProperty } from '@nestjs/swagger';
import { AuditLog } from 'src/schemas/audit-log.schema';

// performedByName is resolved at read time (never stored) - the same
// "compute, never cache" approach used elsewhere, since a user's name can
// change after the entry was recorded and a live lookup keeps it current.
export class AuditLogResponse extends AuditLog {
  @ApiProperty()
  performedByName: string | null;
}
