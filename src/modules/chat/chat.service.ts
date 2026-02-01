import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatSession, ChatSessionStatus } from '../../database/entities/chat-session.entity';
import { ChatMessage, MessageRole } from '../../database/entities/chat-message.entity';
import { Booking } from '../../database/entities/booking.entity';
import { Guest } from '../../database/entities/guest.entity';
import { Hotel } from '../../database/entities/hotel.entity';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatSession)
    private chatSessionRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Guest)
    private guestRepository: Repository<Guest>,
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
  ) {}

  async getOrCreateSession(guestId: string, bookingId?: string): Promise<ChatSession> {
    // Try to find active session
    let session = await this.chatSessionRepository.findOne({
      where: {
        guestId,
        status: ChatSessionStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });

    if (!session) {
      // Create new session
      session = this.chatSessionRepository.create({
        guestId,
        bookingId,
        status: ChatSessionStatus.ACTIVE,
      });
      session = await this.chatSessionRepository.save(session);
      this.logger.log(`Created new chat session: ${session.id}`);
    }

    return session;
  }

  async getSession(sessionId: string): Promise<ChatSession> {
    const session = await this.chatSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    return session;
  }

  async getSessionContext(sessionId: string): Promise<{
    session: ChatSession;
    guest?: Guest;
    booking?: Booking;
    hotel?: Hotel;
  }> {
    const session = await this.chatSessionRepository.findOne({
      where: { id: sessionId },
      relations: ['guest', 'booking'],
    });

    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    let booking: Booking | undefined;
    let hotel: Hotel | undefined;

    if (session.bookingId) {
      booking = await this.bookingRepository.findOne({
        where: { id: session.bookingId },
        relations: ['hotel'],
      });

      if (booking?.hotel) {
        hotel = booking.hotel;
      }
    }

    return {
      session,
      guest: session.guest,
      booking,
      hotel,
    };
  }

  async saveMessage(
    sessionId: string,
    role: MessageRole,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<ChatMessage> {
    const message = this.chatMessageRepository.create({
      sessionId,
      role,
      content,
      metadata,
    });

    const savedMessage = await this.chatMessageRepository.save(message);

    // Update session updated_at
    await this.chatSessionRepository.update(sessionId, {
      updatedAt: new Date(),
    });

    return savedMessage;
  }

  async getMessages(sessionId: string, limit: number = 50): Promise<ChatMessage[]> {
    return this.chatMessageRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.chatSessionRepository.update(sessionId, {
      status: ChatSessionStatus.CLOSED,
    });
  }
}
