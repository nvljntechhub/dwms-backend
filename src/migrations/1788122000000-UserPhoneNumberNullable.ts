import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPhoneNumberNullable1788122000000 implements MigrationInterface {
  name = 'UserPhoneNumberNullable1788122000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "phoneNumber" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "phoneNumber" SET NOT NULL`,
    );
  }
}
