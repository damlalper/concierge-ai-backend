import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.supabaseUrl;
    const key = this.configService.supabaseKey;

    if (url && key) {
      this.client = createClient(url, key);
    }
  }

  getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client not initialized. Check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    }
    return this.client;
  }

  // Helper methods for common operations
  async from(table: string) {
    return this.getClient().from(table);
  }

  async rpc(functionName: string, params?: any) {
    return this.getClient().rpc(functionName, params);
  }

  async storage(bucket: string) {
    return this.getClient().storage.from(bucket);
  }
}
