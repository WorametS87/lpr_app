import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitInferenceTables20260226160000 implements MigrationInterface {
  name = 'InitInferenceTables20260226160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE "inference_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "file_name" character varying(255) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "status" character varying(16) NOT NULL,
        "error_message" text,
        CONSTRAINT "PK_inference_requests_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "detections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "request_id" uuid NOT NULL,
        "plate_number" character varying(32),
        "province" character varying(128),
        "ocr_conf" double precision,
        "province_conf" double precision,
        "bbox_json" jsonb NOT NULL,
        CONSTRAINT "PK_detections_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "inference_requests"
      ADD CONSTRAINT "CHK_inference_requests_status"
      CHECK ("status" IN ('success', 'failed'))
    `);

    await queryRunner.query(`
      ALTER TABLE "detections"
      ADD CONSTRAINT "FK_detections_request_id"
      FOREIGN KEY ("request_id") REFERENCES "inference_requests"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_detections_request_id" ON "detections" ("request_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "public"."IDX_detections_request_id"');
    await queryRunner.query(
      'ALTER TABLE "detections" DROP CONSTRAINT "FK_detections_request_id"'
    );
    await queryRunner.query(
      'ALTER TABLE "inference_requests" DROP CONSTRAINT "CHK_inference_requests_status"'
    );
    await queryRunner.query('DROP TABLE "detections"');
    await queryRunner.query('DROP TABLE "inference_requests"');
  }
}
