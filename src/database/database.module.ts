import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '../config/config.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.postgresUrl,
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        synchronize: configService.nodeEnv === 'development',
        logging: configService.nodeEnv === 'development',
        ssl: configService.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.mongodbUrl,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
