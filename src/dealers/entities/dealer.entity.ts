import { DealerStatus } from 'src/common/utils/enums/dealer.enum';
import {
  DEFAULT_DEALER_COUNTRY,
  DEFAULT_DEALER_CURRENCY,
  DEFAULT_DEALER_LOCALE,
  DEFAULT_DEALER_TIMEZONE,
} from 'src/dealers/dealer-settings.constants';
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
    type: 'char',
    length: 3,
    default: DEFAULT_DEALER_CURRENCY,
  })
  currency: string;

  @Column({
    type: 'char',
    length: 2,
    default: DEFAULT_DEALER_COUNTRY,
  })
  country: string;

  @Column({
    type: 'varchar',
    length: 64,
    default: DEFAULT_DEALER_TIMEZONE,
  })
  timezone: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: DEFAULT_DEALER_LOCALE,
  })
  locale: string;

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
