import { Dealer } from 'src/dealers/entities/dealer.entity';
import { Manufacturer } from 'src/manufacturers/entities/manufacturer.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('products')
@Unique(['dealer', 'sku'])
@Index('idx_products_dealer_id', ['dealer'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  barcode?: string;

  @Column({ name: 'category_id', type: 'varchar', length: 100, nullable: true })
  categoryId?: string;

  @Column({
    name: 'cost_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  costPrice: number;

  @Column({
    name: 'selling_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  sellingPrice: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ name: 'reorder_level', type: 'int', default: 0 })
  reorderLevel: number;

  @RelationId((product: Product) => product.dealer)
  dealerId: string;

  @ManyToOne(() => Dealer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dealer_id' })
  dealer: Dealer;

  @RelationId((product: Product) => product.manufacturer)
  manufacturerId?: string;

  @ManyToOne(() => Manufacturer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'manufacturer_id' })
  manufacturer?: Manufacturer;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt?: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt?: Date;
}
