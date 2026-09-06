import { PurchaseOrderStatus } from 'src/common/utils/enums/purchase-order.enum';
import { Dealer } from 'src/dealers/entities/dealer.entity';
import { Manufacturer } from 'src/manufacturers/entities/manufacturer.entity';
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
import { PurchaseOrderItem } from './purchase-order-item.entity';

@Entity('purchase_orders')
@Index('idx_purchase_orders_dealer_id', ['dealer'])
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.DRAFT,
  })
  status: PurchaseOrderStatus;

  @RelationId((po: PurchaseOrder) => po.dealer)
  dealerId: string;

  @ManyToOne(() => Dealer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dealer_id' })
  dealer: Dealer;

  @RelationId((po: PurchaseOrder) => po.manufacturer)
  manufacturerId: string;

  @ManyToOne(() => Manufacturer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'manufacturer_id' })
  manufacturer: Manufacturer;

  @RelationId((po: PurchaseOrder) => po.warehouse)
  warehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, {
    cascade: true,
  })
  items: PurchaseOrderItem[];

  @Column({
    name: 'submitted_at',
    type: 'timestamp',
    nullable: true,
  })
  submittedAt?: Date | null;

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
