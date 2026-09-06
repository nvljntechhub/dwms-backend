import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPurchaseOrderSubmittedAt1788125000000
  implements MigrationInterface
{
  name = 'AddPurchaseOrderSubmittedAt1788125000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD "submitted_at" TIMESTAMP`,
    );
    await queryRunner.query(`
      UPDATE "purchase_orders"
      SET "submitted_at" = COALESCE("updated_at", "created_at")
      WHERE "status" IN ('ORDERED', 'PARTIALLY_RECEIVED', 'COMPLETED')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP COLUMN "submitted_at"`,
    );
  }
}
