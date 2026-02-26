import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DetectionEntity } from '../database/entities/detection.entity';
import { InferenceRequestEntity } from '../database/entities/inference-request.entity';
import { InferController } from './infer.controller';
import { InferService } from './infer.service';

@Module({
  imports: [TypeOrmModule.forFeature([InferenceRequestEntity, DetectionEntity])],
  controllers: [InferController],
  providers: [InferService]
})
export class InferModule {}
