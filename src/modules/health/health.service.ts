import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection as MongoConnection } from 'mongoose';

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectConnection() private mongoConnection: MongoConnection,
  ) {}

  async getHealth() {
    const checks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: await this.checkPostgres(),
        mongodb: await this.checkMongoDB(),
      },
    };

    const allHealthy = Object.values(checks.services).every((s) => s === 'healthy');
    checks.status = allHealthy ? 'healthy' : 'unhealthy';

    return checks;
  }

  async getReady() {
    const postgresReady = await this.checkPostgres();
    const mongoReady = await this.checkMongoDB();

    return {
      ready: postgresReady === 'healthy' && mongoReady === 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  async getLive() {
    return {
      alive: true,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkPostgres(): Promise<'healthy' | 'unhealthy'> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'healthy';
    } catch (error) {
      return 'unhealthy';
    }
  }

  private async checkMongoDB(): Promise<'healthy' | 'unhealthy'> {
    try {
      await this.mongoConnection.db.admin().ping();
      return 'healthy';
    } catch (error) {
      return 'unhealthy';
    }
  }
}
