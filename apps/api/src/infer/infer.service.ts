import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import FormData from 'form-data';
import {
  type DebugInfo,
  type DetectionResult,
  type InferenceResponse
} from '@lpr/shared-types';
import { DetectionEntity } from '../database/entities/detection.entity';
import { InferenceRequestEntity } from '../database/entities/inference-request.entity';

interface ModelDetection {
  plateNumber: string | null;
  province: string | null;
  ocrConf: number;
  provinceConf: number;
  plateSource?: string;
  provinceSource?: string;
  bbox: [number, number, number, number];
}

interface ModelInferResponse {
  detections: ModelDetection[];
  debugInfo: DebugInfo;
}

@Injectable()
export class InferService {
  private readonly modelServerUrl: string;

  constructor(
    @InjectRepository(InferenceRequestEntity)
    private readonly requestRepository: Repository<InferenceRequestEntity>,
    @InjectRepository(DetectionEntity)
    private readonly detectionRepository: Repository<DetectionEntity>
  ) {
    this.modelServerUrl = process.env.MODEL_SERVER_URL ?? 'http://localhost:8000';
  }

  async inferImage(file: Express.Multer.File): Promise<InferenceResponse> {
    const request = this.requestRepository.create({
      fileName: file.originalname,
      status: 'success',
      errorMessage: null
    });
    await this.requestRepository.save(request);

    try {
      const { detections, debugInfo } = await this.callModelServer(file);

      if (detections.length > 0) {
        const detectionRows = detections.map((d) =>
          this.detectionRepository.create({
            requestId: request.id,
            plateNumber: d.plateNumber,
            province: d.province,
            ocrConf: d.ocrConf,
            provinceConf: d.provinceConf,
            bboxJson: d.bbox
          })
        );
        await this.detectionRepository.save(detectionRows);
      }

      return {
        requestId: request.id,
        detections: detections.map<DetectionResult>((d) => ({
          plateNumber: d.plateNumber,
          province: d.province,
          ocrConf: d.ocrConf,
          provinceConf: d.provinceConf,
          plateSource: d.plateSource,
          provinceSource: d.provinceSource,
          bbox: d.bbox
        })),
        message:
          detections.length > 0
            ? `${detections.length} plate detected`
            : 'No plate detected',
        debugInfo
      };
    } catch (error) {
      request.status = 'failed';
      request.errorMessage =
        error instanceof Error ? error.message : 'Inference processing failed';
      await this.requestRepository.save(request);
      throw new InternalServerErrorException('Inference failed');
    }
  }

  private async callModelServer(
    file: Express.Multer.File
  ): Promise<ModelInferResponse> {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype
    });

    const response = await axios.post<ModelInferResponse>(
      `${this.modelServerUrl}/infer`,
      form,
      { headers: form.getHeaders() }
    );

    return response.data;
  }
}
