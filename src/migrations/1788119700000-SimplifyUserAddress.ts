import { MigrationInterface, QueryRunner } from 'typeorm';

export class SimplifyUserAddress1788119700000 implements MigrationInterface {
  name = 'SimplifyUserAddress1788119700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_address" RENAME COLUMN "line1" TO "street"`,
    );
    await queryRunner.query(`ALTER TABLE "user_address" DROP COLUMN "line2"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_address" ADD "line2" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_address" RENAME COLUMN "street" TO "line1"`,
    );
  }
}
