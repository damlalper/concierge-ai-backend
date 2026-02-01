import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ProcessingProcessor } from './processing.processor';
import { Booking } from '../../database/entities/booking.entity';
import { Guest } from '../../database/entities/guest.entity';
import { Hotel } from '../../database/entities/hotel.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Guest, Hotel]),
    BullModule.registerQueue({
      name: 'webhook-processing',
    }),
  ],
  providers: [ProcessingProcessor],
})
export class ProcessingModule {}
