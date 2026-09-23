import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { VoidRequestStatus } from 'src/enums';

// Embedded on Sale (as `voidRequest`) rather than adding a 4th SaleStatus
// value - status stays Completed while a request is Pending, and only
// flips to Voided once this sub-document's own status becomes Approved
// (see SaleService.requestVoid/approveVoid).
//
// @Schema() is required even though this is never a top-level collection -
// SchemaFactory.createForClass() only discovers @Prop() fields on classes
// decorated with @Schema(); without it the embedded sub-document silently
// saves as empty. _id: false since a sale only ever has one at a time.
@Schema({ _id: false })
export class VoidRequest {
  @Prop({ type: String, enum: VoidRequestStatus, required: true })
  @ApiProperty({ enum: VoidRequestStatus })
  status: VoidRequestStatus;

  @Prop({ required: true })
  @ApiProperty()
  reason: string;

  @Prop({ required: true })
  @ApiProperty()
  requestedById: string;

  @Prop({ required: true })
  @ApiProperty()
  requestedAt: Date;

  // Also the approver in Instant mode - the requester approves their own
  // request the moment they make it (see SaleService.requestVoid).
  @Prop({ type: String, default: null })
  @ApiProperty()
  reviewedById: string | null;

  @Prop({ type: Date, default: null })
  @ApiProperty()
  reviewedAt: Date | null;

  @Prop({ type: String, default: null })
  @ApiProperty()
  reviewNotes: string | null;
}
