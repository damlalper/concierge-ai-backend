import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Guest } from '../../database/entities/guest.entity';
import { Hotel } from '../../database/entities/hotel.entity';
import { WebhookBookingDto } from '../webhook/dto/webhook-booking.dto';

interface ProcessingJobData {
  payload: WebhookBookingDto;
  sourceSystem: string;
  requestId: string;
  correlationId: string;
  webhookEventId: string;
}

@Processor('webhook-processing', {
  concurrency: 5,
})
export class ProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(ProcessingProcessor.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Guest)
    private guestRepository: Repository<Guest>,
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
  ) {
    super();
  }

  async process(job: Job<ProcessingJobData>): Promise<void> {
    const { payload, sourceSystem, correlationId } = job.data;

    this.logger.log(
      `Processing job ${job.id} - CorrelationId: ${correlationId} - Source: ${sourceSystem}`,
    );

    try {
      // Map external schema to internal schema
      const bookingData = await this.mapBookingData(payload, sourceSystem);

      // Find or create guest
      let guest = await this.guestRepository.findOne({
        where: { email: payload.guest.email },
      });

      if (!guest) {
        guest = this.guestRepository.create({
          email: payload.guest.email,
          firstName: payload.guest.firstName,
          lastName: payload.guest.lastName,
          phone: payload.guest.phone,
        });
        guest = await this.guestRepository.save(guest);
        this.logger.log(`Created new guest: ${guest.id}`);
      }

      // Verify hotel exists
      const hotel = await this.hotelRepository.findOne({
        where: { id: payload.hotelId },
      });

      if (!hotel) {
        throw new Error(`Hotel not found: ${payload.hotelId}`);
      }

      // Find or create booking
      let booking = await this.bookingRepository.findOne({
        where: {
          externalBookingId: payload.bookingId,
          sourceSystem: sourceSystem,
        },
      });

      const bookingStatus = this.mapBookingStatus(payload.eventType);

      if (booking) {
        // Update existing booking
        booking.checkIn = new Date(payload.checkIn);
        booking.checkOut = new Date(payload.checkOut);
        booking.totalAmount = payload.totalAmount;
        booking.currency = payload.currency;
        booking.status = bookingStatus;
        booking.metadata = payload.metadata || {};
        booking = await this.bookingRepository.save(booking);
        this.logger.log(`Updated booking: ${booking.id}`);
      } else {
        // Create new booking
        booking = this.bookingRepository.create({
          externalBookingId: payload.bookingId,
          sourceSystem: sourceSystem,
          hotelId: payload.hotelId,
          guestId: guest.id,
          checkIn: new Date(payload.checkIn),
          checkOut: new Date(payload.checkOut),
          totalAmount: payload.totalAmount,
          currency: payload.currency,
          status: bookingStatus,
          metadata: payload.metadata || {},
        });
        booking = await this.bookingRepository.save(booking);
        this.logger.log(`Created new booking: ${booking.id}`);
      }

      this.logger.log(
        `Job ${job.id} completed successfully - BookingId: ${booking.id} - CorrelationId: ${correlationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Job ${job.id} failed - CorrelationId: ${correlationId} - Error: ${error.message}`,
        error.stack,
      );
      throw error; // Will trigger retry mechanism
    }
  }

  private async mapBookingData(
    payload: WebhookBookingDto,
    sourceSystem: string,
  ): Promise<Partial<Booking>> {
    // Source-specific mapping logic can be added here
    // For now, using direct mapping
    return {
      externalBookingId: payload.bookingId,
      sourceSystem: sourceSystem,
      checkIn: new Date(payload.checkIn),
      checkOut: new Date(payload.checkOut),
      totalAmount: payload.totalAmount,
      currency: payload.currency,
    };
  }

  private mapBookingStatus(eventType: string): BookingStatus {
    switch (eventType) {
      case 'booking.created':
        return BookingStatus.CONFIRMED;
      case 'booking.updated':
        return BookingStatus.CONFIRMED;
      case 'booking.cancelled':
        return BookingStatus.CANCELLED;
      default:
        return BookingStatus.CONFIRMED;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
  }
}
