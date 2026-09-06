import { Dealer } from 'src/dealers/entities/dealer.entity';
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
} from 'typeorm';

@Entity('shops')
@Unique(['dealer', 'name'])
@Index('idx_shops_dealer_id', ['dealer'])
export class Shop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 255, nullable: true })
  contactName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ name: 'shipping_address', type: 'text' })
  shippingAddress: string;

  @Column({ name: 'billing_address', type: 'text', nullable: true })
  billingAddress?: string;

  @Column({
    name: 'credit_limit',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  creditLimit: number;

  @Column({
    name: 'current_balance',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  currentBalance: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @RelationId((shop: Shop) => shop.dealer)
  dealerId: string;

  @ManyToOne(() => Dealer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dealer_id' })
  dealer: Dealer;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt?: Date;
}
