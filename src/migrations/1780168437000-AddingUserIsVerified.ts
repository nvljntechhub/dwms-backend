import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddingUserIsVerified1780168437000 implements MigrationInterface {
  name = 'AddingUserIsVerified1780168437000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "isVerified" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isVerified"`);
  }
}
