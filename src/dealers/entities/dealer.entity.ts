import { DealerStatus } from 'src/common/utils/enums/dealer.enum';
import { User } from 'src/users/entities/user.entity';
import { Warehouse } from 'src/warehouses/entities/warehouse.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('dealers')
export class Dealer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'tax_id', type: 'varchar', length: 100, nullable: true })
  taxId?: string;

  @Column({
    type: 'enum',
    enum: DealerStatus,
    default: DealerStatus.ACTIVE,
  })
  status: DealerStatus;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt?: Date;

  @OneToMany(() => User, (user) => user.dealer)
  users: User[];

  @OneToMany(() => Warehouse, (warehouse) => warehouse.dealer)
  warehouses: Warehouse[];
}
