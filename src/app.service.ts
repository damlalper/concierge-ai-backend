import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Concierge-AI Backend API v1.0';
  }
}
