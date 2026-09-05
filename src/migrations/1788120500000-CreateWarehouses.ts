import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWarehouses1788120500000 implements MigrationInterface {
  name = 'CreateWarehouses1788120500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "warehouses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "dealer_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_warehouses" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "warehouses" ADD CONSTRAINT "FK_warehouses_dealer" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "warehouses" DROP CONSTRAINT "FK_warehouses_dealer"`,
    );
    await queryRunner.query(`DROP TABLE "warehouses"`);
  }
}
