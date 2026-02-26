import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { InferModule } from './infer/infer.module';
import { DetectionEntity } from './database/entities/detection.entity';
import { InferenceRequestEntity } from './database/entities/inference-request.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'lpr',
      password: process.env.DB_PASSWORD ?? 'lpr',
      database: process.env.DB_NAME ?? 'lpr',
      entities: [InferenceRequestEntity, DetectionEntity],
      migrations: ['dist/database/migrations/*.js'],
      synchronize: false,
      logging: false
    }),
    InferModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
