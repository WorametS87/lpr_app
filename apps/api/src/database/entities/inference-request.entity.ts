import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn
} from 'typeorm';
import { DetectionEntity } from './detection.entity';

export type InferenceRequestStatus = 'success' | 'failed';

@Entity({ name: 'inference_requests' })
export class InferenceRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'status', type: 'varchar', length: 16 })
  status!: InferenceRequestStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @OneToMany(() => DetectionEntity, (detection) => detection.request)
  detections!: DetectionEntity[];
}
