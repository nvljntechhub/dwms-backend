import { SalesOrderStatus } from 'src/common/utils/enums/sales-order.enum';
import { Dealer } from 'src/dealers/entities/dealer.entity';
import { Shop } from 'src/shops/entities/shop.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';
import { SalesOrderItem } from './sales-order-item.entity';

@Entity('sales_orders')
@Index('idx_sales_orders_dealer_id', ['dealer'])
export class SalesOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: SalesOrderStatus,
    default: SalesOrderStatus.PENDING,
  })
  status: SalesOrderStatus;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalAmount: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @RelationId((so: SalesOrder) => so.dealer)
  dealerId: string;

  @ManyToOne(() => Dealer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dealer_id' })
  dealer: Dealer;

  @RelationId((so: SalesOrder) => so.shop)
  shopId: string;

  @ManyToOne(() => Shop, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'shop_id' })
  shop: Shop;

  @RelationId((so: SalesOrder) => so.warehouse)
  warehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @OneToMany(() => SalesOrderItem, (item) => item.salesOrder, { cascade: true })
  items: SalesOrderItem[];

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
