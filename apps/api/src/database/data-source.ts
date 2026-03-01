import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { DetectionEntity } from './entities/detection.entity';
import { InferenceRequestEntity } from './entities/inference-request.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'lpr',
  password: process.env.DB_PASSWORD ?? 'lpr',
  database: process.env.DB_NAME ?? 'lpr',
  entities: [InferenceRequestEntity, DetectionEntity],
  synchronize: (process.env.TYPEORM_SYNC ?? 'true') === 'true'
});
