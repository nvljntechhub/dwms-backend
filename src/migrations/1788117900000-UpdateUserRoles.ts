import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUserRoles1788117900000 implements MigrationInterface {
  name = 'UpdateUserRoles1788117900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."user_role_enum" RENAME TO "user_role_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_role_enum" AS ENUM('SUPER_ADMIN', 'ADMIN', 'WAREHOUSE_MANAGER', 'STAFF', 'DRIVER')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "role" TYPE "public"."user_role_enum" USING (
        CASE
          WHEN "role"::text = '1' THEN 'ADMIN'
          WHEN "role"::text = '2' THEN 'STAFF'
          ELSE 'STAFF'
        END
      )::"public"."user_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'STAFF'`,
    );
    await queryRunner.query(`DROP TYPE "public"."user_role_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."user_role_enum" RENAME TO "user_role_enum_new"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_role_enum" AS ENUM('1', '2')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "role" TYPE "public"."user_role_enum" USING (
        CASE
          WHEN "role"::text = 'ADMIN' THEN '1'
          WHEN "role"::text = 'SUPER_ADMIN' THEN '1'
          ELSE '2'
        END
      )::"public"."user_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT '2'`,
    );
    await queryRunner.query(`DROP TYPE "public"."user_role_enum_new"`);
  }
}
