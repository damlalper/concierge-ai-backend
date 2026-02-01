import { DataSource } from 'typeorm';
import { ConfigService } from '../config/config.service';

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgresql://concierge:concierge123@localhost:5432/concierge_ai',
  entities: [__dirname + '/entities/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
