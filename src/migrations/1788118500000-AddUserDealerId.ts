import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserDealerId1788118500000 implements MigrationInterface {
  name = 'AddUserDealerId1788118500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "dealer_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_user_dealer" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_user_dealer"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "dealer_id"`);
  }
}
