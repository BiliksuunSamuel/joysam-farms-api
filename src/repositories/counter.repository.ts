import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Counter } from 'src/schemas/counter.schema';

@Injectable()
export class CounterRepository {
  constructor(
    @InjectModel(Counter.name) private readonly counterRepository: Model<Counter>,
  ) {}

  //atomically returns the next number in the named sequence, creating it at 1 if new
  async next(key: string): Promise<number> {
    const counter = await this.counterRepository
      .findOneAndUpdate(
        { key },
        { $inc: { seq: 1 } },
        { upsert: true, new: true },
      )
      .lean();
    return counter.seq;
  }

  //read-only peek at the current value of a sequence, without incrementing it
  async peek(key: string): Promise<number> {
    const counter = await this.counterRepository.findOne({ key }).lean();
    return counter?.seq ?? 0;
  }
}
