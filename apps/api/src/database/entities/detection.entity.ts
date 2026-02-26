import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { InferenceRequestEntity } from './inference-request.entity';

@Entity({ name: 'detections' })
export class DetectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId!: string;

  @ManyToOne(() => InferenceRequestEntity, (request) => request.detections, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'request_id' })
  request!: InferenceRequestEntity;

  @Column({ name: 'plate_number', type: 'varchar', length: 32, nullable: true })
  plateNumber!: string | null;

  @Column({ name: 'province', type: 'varchar', length: 128, nullable: true })
  province!: string | null;

  @Column({ name: 'ocr_conf', type: 'float', nullable: true })
  ocrConf!: number | null;

  @Column({ name: 'province_conf', type: 'float', nullable: true })
  provinceConf!: number | null;

  @Column({ name: 'bbox_json', type: 'jsonb' })
  bboxJson!: number[];
}
