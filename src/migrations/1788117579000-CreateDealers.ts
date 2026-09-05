import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDealers1788117579000 implements MigrationInterface {
  name = 'CreateDealers1788117579000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."dealers_status_enum" AS ENUM('ACTIVE', 'SUSPENDED', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "dealers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "tax_id" character varying(100), "status" "public"."dealers_status_enum" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_dealers_email" UNIQUE ("email"), CONSTRAINT "PK_dealers" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "dealers"`);
    await queryRunner.query(`DROP TYPE "public"."dealers_status_enum"`);
  }
}
