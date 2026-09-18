import { Prop, Schema } from '@nestjs/mongoose';

/**
 * A generic atomic sequence, keyed by name (e.g. "sale:<shopId>"). Used
 * wherever a feature needs gapless-enough, human-readable sequential
 * numbers (like a receipt number) without the race condition of
 * count-documents-then-add-one under concurrent writes. Not a BaseSchema
 * entity - this is infrastructure, not a business record.
 */
@Schema()
export class Counter {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ default: 0 })
  seq: number;
}
