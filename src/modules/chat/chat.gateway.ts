import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AiService } from '../ai/ai.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/guest',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly activeSessions = new Map<string, string>(); // socketId -> sessionId

  constructor(
    private chatService: ChatService,
    private aiService: AiService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    try {
      // Extract guest ID from auth token or query params
      const guestId = client.handshake.query.guestId as string;
      const bookingId = client.handshake.query.bookingId as string;

      if (!guestId) {
        this.logger.warn(`Connection rejected: No guestId provided`);
        client.disconnect();
        return;
      }

      // Create or retrieve chat session
      const session = await this.chatService.getOrCreateSession(guestId, bookingId);

      // Join room for this session
      client.join(`session:${session.id}`);
      this.activeSessions.set(client.id, session.id);

      // Emit session created event
      client.emit('session:created', {
        sessionId: session.id,
        guestId: session.guestId,
        bookingId: session.bookingId,
      });

      this.logger.log(`Session created/retrieved: ${session.id} for guest: ${guestId}`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`, error.stack);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const sessionId = this.activeSessions.get(client.id);
    this.logger.log(`Client disconnected: ${client.id} - Session: ${sessionId}`);

    if (sessionId) {
      this.activeSessions.delete(client.id);
      // Optionally close session or mark as inactive
    }
  }

  @SubscribeMessage('guest:message')
  async handleMessage(
    @MessageBody() data: { message: string; sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { message, sessionId } = data;

    this.logger.log(`Message received - Session: ${sessionId} - Message: ${message.substring(0, 50)}...`);

    try {
      // Save user message
      await this.chatService.saveMessage(sessionId, 'user', message);

      // Emit typing indicator
      client.emit('assistant:typing', { sessionId, isTyping: true });
      client.to(`session:${sessionId}`).emit('assistant:typing', { sessionId, isTyping: true });

      // Get session context
      const session = await this.chatService.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Get guest and booking context
      const context = await this.chatService.getSessionContext(sessionId);

      // Generate embedding for user question
      const queryEmbedding = await this.aiService.generateEmbedding(message);

      // Search similar chunks
      const hotelId = context.booking?.hotelId || null;
      const chunks = hotelId
        ? await this.aiService.searchSimilarChunks(queryEmbedding, hotelId, 5, 0.7)
        : [];

      // Generate response
      const responseStream = await this.aiService.generateStreamingResponse(
        message,
        chunks,
        {
          name: context.guest ? `${context.guest.firstName} ${context.guest.lastName}` : undefined,
          bookingId: context.booking?.id,
          checkIn: context.booking?.checkIn,
          checkOut: context.booking?.checkOut,
        },
        context.hotel?.name,
      );

      // Stream response
      let fullResponse = '';
      for await (const chunk of responseStream) {
        fullResponse += chunk;
        client.emit('assistant:response', {
          sessionId,
          message: chunk,
          messageId: '',
          timestamp: Date.now(),
          isComplete: false,
        });
      }

      // Save assistant message
      const savedMessage = await this.chatService.saveMessage(sessionId, 'assistant', fullResponse);

      // Emit final response
      client.emit('assistant:response', {
        sessionId,
        message: fullResponse,
        messageId: savedMessage.id,
        timestamp: Date.now(),
        isComplete: true,
      });

      // Stop typing indicator
      client.emit('assistant:typing', { sessionId, isTyping: false });
      client.to(`session:${sessionId}`).emit('assistant:typing', { sessionId, isTyping: false });
    } catch (error) {
      this.logger.error(`Error handling message: ${error.message}`, error.stack);

      client.emit('assistant:error', {
        sessionId,
        error: 'Bir hata oluştu. Lütfen tekrar deneyin.',
        code: 'INTERNAL_ERROR',
      });

      client.emit('assistant:typing', { sessionId, isTyping: false });
    }
  }

  @SubscribeMessage('guest:typing')
  handleTyping(
    @MessageBody() data: { sessionId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    // Broadcast typing status to other clients in the session
    client.to(`session:${data.sessionId}`).emit('guest:typing', data);
  }
}
