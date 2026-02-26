import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  type DetectionResult,
  type InferenceResponse
} from '@lpr/shared-types';
import { DetectionEntity } from '../database/entities/detection.entity';
import { InferenceRequestEntity } from '../database/entities/inference-request.entity';

@Injectable()
export class InferService {
  constructor(
    @InjectRepository(InferenceRequestEntity)
    private readonly requestRepository: Repository<InferenceRequestEntity>,
    @InjectRepository(DetectionEntity)
    private readonly detectionRepository: Repository<DetectionEntity>
  ) {}

  async inferImage(file: Express.Multer.File): Promise<InferenceResponse> {
    const request = this.requestRepository.create({
      fileName: file.originalname,
      status: 'success',
      errorMessage: null
    });

    await this.requestRepository.save(request);

    try {
      const detections = this.runMockInference(file.originalname);

      if (detections.length > 0) {
        const detectionRows = detections.map((detection) =>
          this.detectionRepository.create({
            requestId: request.id,
            plateNumber: detection.plateNumber,
            province: detection.province,
            ocrConf: detection.ocrConf,
            provinceConf: detection.provinceConf,
            bboxJson: detection.bbox
          })
        );

        await this.detectionRepository.save(detectionRows);
      }

      return {
        requestId: request.id,
        detections,
        message:
          detections.length > 0
            ? `${detections.length} plate detected`
            : 'No plate detected'
      };
    } catch (error) {
      request.status = 'failed';
      request.errorMessage =
        error instanceof Error ? error.message : 'Inference processing failed';
      await this.requestRepository.save(request);
      throw new InternalServerErrorException('Inference failed');
    }
  }

  private runMockInference(fileName: string): DetectionResult[] {
    const inferredPlate = fileName
      .toUpperCase()
      .replace(/\.[^.]+$/, '')
      .match(/[A-Z0-9]{4,8}/)?.[0];

    if (!inferredPlate) {
      return [];
    }

    return [
      {
        plateNumber: inferredPlate,
        province: 'Unknown',
        ocrConf: 0.84,
        provinceConf: 0.5,
        bbox: [100, 200, 300, 260]
      }
    ];
  }
}
