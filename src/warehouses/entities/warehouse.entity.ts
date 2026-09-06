import { Dealer } from 'src/dealers/entities/dealer.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';

export const DEFAULT_WAREHOUSE_NAME = 'Main Warehouse';

@Entity('warehouses')
export class Warehouse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'varchar', nullable: true })
  street?: string;

  @Column({ type: 'varchar', nullable: true })
  city?: string;

  @Column({ type: 'varchar', nullable: true })
  state?: string;

  @Column({ name: 'postalCode', type: 'varchar', nullable: true })
  postalCode?: string;

  @Column({ type: 'varchar', nullable: true })
  country?: string;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  latitude?: number;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  longitude?: number;

  @RelationId((warehouse: Warehouse) => warehouse.dealer)
  dealerId: string;

  @ManyToOne(() => Dealer, (dealer) => dealer.warehouses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'dealer_id', referencedColumnName: 'id' })
  dealer: Dealer;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt?: Date;
}
