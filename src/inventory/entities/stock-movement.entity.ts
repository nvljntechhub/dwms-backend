import { StockMovementType } from 'src/common/utils/enums/stock-movement.enum';
import { Dealer } from 'src/dealers/entities/dealer.entity';
import { Product } from 'src/products/entities/product.entity';
import { User } from 'src/users/entities/user.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';

@Entity('stock_movements')
@Index('idx_stock_movements_dealer_id', ['dealer'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'movement_type',
    type: 'enum',
    enum: StockMovementType,
  })
  movementType: StockMovementType;

  @Column({ name: 'quantity_delta', type: 'int' })
  quantityDelta: number;

  @Column({ name: 'reference_type', type: 'varchar', length: 50, nullable: true })
  referenceType?: string;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId?: string;

  @RelationId((movement: StockMovement) => movement.dealer)
  dealerId: string;

  @ManyToOne(() => Dealer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dealer_id' })
  dealer: Dealer;

  @RelationId((movement: StockMovement) => movement.product)
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @RelationId((movement: StockMovement) => movement.warehouse)
  warehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @RelationId((movement: StockMovement) => movement.user)
  userId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt?: Date;
}
