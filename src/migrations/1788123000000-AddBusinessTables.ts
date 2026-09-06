import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessTables1788123000000 implements MigrationInterface {
  name = 'AddBusinessTables1788123000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "warehouses" ADD "street" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "warehouses" ADD "city" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "warehouses" ADD "state" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "warehouses" ADD "postalCode" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "warehouses" ADD "country" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "warehouses" ADD "latitude" numeric(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "warehouses" ADD "longitude" numeric(10,7)`,
    );

    await queryRunner.query(`
      CREATE TABLE "manufacturers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "contact_name" character varying(255),
        "email" character varying(255),
        "phone" character varying(50),
        "lead_time_days" integer NOT NULL DEFAULT 0,
        "dealer_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_manufacturers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_manufacturers_dealer_name" UNIQUE ("dealer_id", "name")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_manufacturers_dealer_id" ON "manufacturers" ("dealer_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "manufacturers" ADD CONSTRAINT "FK_manufacturers_dealer" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(`
      CREATE TABLE "shops" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "contact_name" character varying(255),
        "email" character varying(255),
        "phone" character varying(50),
        "shipping_address" text NOT NULL,
        "billing_address" text,
        "credit_limit" numeric(12,2) NOT NULL DEFAULT 0,
        "current_balance" numeric(12,2) NOT NULL DEFAULT 0,
        "dealer_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shops" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_shops_dealer_name" UNIQUE ("dealer_id", "name")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_shops_dealer_id" ON "shops" ("dealer_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "shops" ADD CONSTRAINT "FK_shops_dealer" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "sku" character varying(100) NOT NULL,
        "name" character varying(255) NOT NULL,
        "barcode" character varying(100),
        "category_id" character varying(100),
        "cost_price" numeric(12,2) NOT NULL DEFAULT 0,
        "selling_price" numeric(12,2) NOT NULL DEFAULT 0,
        "reorder_level" integer NOT NULL DEFAULT 0,
        "dealer_id" uuid NOT NULL,
        "manufacturer_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_products_dealer_sku" UNIQUE ("dealer_id", "sku")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_products_dealer_id" ON "products" ("dealer_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_products_dealer" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_products_manufacturer" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "inventory" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "quantity_on_hand" integer NOT NULL DEFAULT 0,
        "quantity_allocated" integer NOT NULL DEFAULT 0,
        "dealer_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "warehouse_id" uuid NOT NULL,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_inventory_product_warehouse" UNIQUE ("product_id", "warehouse_id"),
        CONSTRAINT "CHK_inventory_on_hand" CHECK ("quantity_on_hand" >= 0),
        CONSTRAINT "CHK_inventory_allocated" CHECK ("quantity_allocated" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_inventory_dealer_id" ON "inventory" ("dealer_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" ADD CONSTRAINT "FK_inventory_dealer" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" ADD CONSTRAINT "FK_inventory_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" ADD CONSTRAINT "FK_inventory_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `CREATE TYPE "stock_movements_movement_type_enum" AS ENUM('PO_RECEIPT', 'SO_DISPATCH', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT')`,
    );
    await queryRunner.query(`
      CREATE TABLE "stock_movements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "movement_type" "stock_movements_movement_type_enum" NOT NULL,
        "quantity_delta" integer NOT NULL,
        "reference_type" character varying(50),
        "reference_id" uuid,
        "dealer_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "warehouse_id" uuid NOT NULL,
        "user_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_movements" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_stock_movements_dealer_id" ON "stock_movements" ("dealer_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_stock_movements_dealer" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_stock_movements_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_stock_movements_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_stock_movements_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `CREATE TYPE "purchase_orders_status_enum" AS ENUM('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "purchase_orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "status" "purchase_orders_status_enum" NOT NULL DEFAULT 'DRAFT',
        "dealer_id" uuid NOT NULL,
        "manufacturer_id" uuid NOT NULL,
        "warehouse_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_purchase_orders" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_orders_dealer_id" ON "purchase_orders" ("dealer_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_purchase_orders_dealer" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_purchase_orders_manufacturer" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_purchase_orders_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT`,
    );

    await queryRunner.query(`
      CREATE TABLE "purchase_order_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "quantity_ordered" integer NOT NULL,
        "quantity_received" integer NOT NULL DEFAULT 0,
        "purchase_order_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        CONSTRAINT "PK_purchase_order_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ADD CONSTRAINT "FK_purchase_order_items_po" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ADD CONSTRAINT "FK_purchase_order_items_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT`,
    );

    await queryRunner.query(
      `CREATE TYPE "sales_orders_status_enum" AS ENUM('PENDING', 'APPROVED', 'PICKING', 'SHIPPED', 'DELIVERED', 'CANCELLED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "sales_orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "status" "sales_orders_status_enum" NOT NULL DEFAULT 'PENDING',
        "total_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "dealer_id" uuid NOT NULL,
        "shop_id" uuid NOT NULL,
        "warehouse_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_orders" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_sales_orders_dealer_id" ON "sales_orders" ("dealer_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD CONSTRAINT "FK_sales_orders_dealer" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD CONSTRAINT "FK_sales_orders_shop" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD CONSTRAINT "FK_sales_orders_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT`,
    );

    await queryRunner.query(`
      CREATE TABLE "sales_order_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "quantity" integer NOT NULL,
        "unit_price" numeric(12,2) NOT NULL,
        "quantity_shipped" integer NOT NULL DEFAULT 0,
        "sales_order_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        CONSTRAINT "PK_sales_order_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "sales_order_items" ADD CONSTRAINT "FK_sales_order_items_so" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_items" ADD CONSTRAINT "FK_sales_order_items_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "sales_order_items"`);
    await queryRunner.query(`DROP TABLE "sales_orders"`);
    await queryRunner.query(`DROP TYPE "sales_orders_status_enum"`);
    await queryRunner.query(`DROP TABLE "purchase_order_items"`);
    await queryRunner.query(`DROP TABLE "purchase_orders"`);
    await queryRunner.query(`DROP TYPE "purchase_orders_status_enum"`);
    await queryRunner.query(`DROP TABLE "stock_movements"`);
    await queryRunner.query(`DROP TYPE "stock_movements_movement_type_enum"`);
    await queryRunner.query(`DROP TABLE "inventory"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TABLE "shops"`);
    await queryRunner.query(`DROP TABLE "manufacturers"`);
    await queryRunner.query(`ALTER TABLE "warehouses" DROP COLUMN "longitude"`);
    await queryRunner.query(`ALTER TABLE "warehouses" DROP COLUMN "latitude"`);
    await queryRunner.query(`ALTER TABLE "warehouses" DROP COLUMN "country"`);
    await queryRunner.query(`ALTER TABLE "warehouses" DROP COLUMN "postalCode"`);
    await queryRunner.query(`ALTER TABLE "warehouses" DROP COLUMN "state"`);
    await queryRunner.query(`ALTER TABLE "warehouses" DROP COLUMN "city"`);
    await queryRunner.query(`ALTER TABLE "warehouses" DROP COLUMN "street"`);
  }
}
