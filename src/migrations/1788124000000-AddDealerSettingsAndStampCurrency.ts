import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDealerSettingsAndStampCurrency1788124000000
  implements MigrationInterface
{
  name = 'AddDealerSettingsAndStampCurrency1788124000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dealers" ADD "currency" character(3) NOT NULL DEFAULT 'LKR'`,
    );
    await queryRunner.query(
      `ALTER TABLE "dealers" ADD "country" character(2) NOT NULL DEFAULT 'LK'`,
    );
    await queryRunner.query(
      `ALTER TABLE "dealers" ADD "timezone" character varying(64) NOT NULL DEFAULT 'Asia/Colombo'`,
    );
    await queryRunner.query(
      `ALTER TABLE "dealers" ADD "locale" character varying(16) NOT NULL DEFAULT 'en-LK'`,
    );

    await queryRunner.query(
      `ALTER TABLE "products" ADD "currency" character(3) NOT NULL DEFAULT 'LKR'`,
    );
    await queryRunner.query(
      `ALTER TABLE "shops" ADD "currency" character(3) NOT NULL DEFAULT 'LKR'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD "currency" character(3) NOT NULL DEFAULT 'LKR'`,
    );

    await queryRunner.query(`
      UPDATE "products" AS product
      SET "currency" = dealer."currency"
      FROM "dealers" AS dealer
      WHERE product."dealer_id" = dealer."id"
    `);
    await queryRunner.query(`
      UPDATE "shops" AS shop
      SET "currency" = dealer."currency"
      FROM "dealers" AS dealer
      WHERE shop."dealer_id" = dealer."id"
    `);
    await queryRunner.query(`
      UPDATE "sales_orders" AS sales_order
      SET "currency" = dealer."currency"
      FROM "dealers" AS dealer
      WHERE sales_order."dealer_id" = dealer."id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sales_orders" DROP COLUMN "currency"`);
    await queryRunner.query(`ALTER TABLE "shops" DROP COLUMN "currency"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "currency"`);
    await queryRunner.query(`ALTER TABLE "dealers" DROP COLUMN "locale"`);
    await queryRunner.query(`ALTER TABLE "dealers" DROP COLUMN "timezone"`);
    await queryRunner.query(`ALTER TABLE "dealers" DROP COLUMN "country"`);
    await queryRunner.query(`ALTER TABLE "dealers" DROP COLUMN "currency"`);
  }
}
