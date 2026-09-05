import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { HASH_SALT_ROUNDS } from 'src/config/hash.config';
import { UserRole } from 'src/common/utils/enums/user-role';
import { UserAddress } from 'src/user-addresses/entities/user-address.entity';
import { BaseEntity } from 'src/common/utils/BaseEntity';
import { Dealer } from 'src/dealers/entities/dealer.entity';

@Entity()
export class User extends BaseEntity {
  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true, nullable: true })
  phoneNumber?: string;

  @Column({ select: false })
  password: string;

  @Column({ nullable: true })
  profileURL: string;

  @Column({ type: 'date' })
  joinedDate: Date;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.STAFF,
  })
  role: UserRole;

  @Column({ default: false })
  isVerified: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt?: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt?: Date;

  @RelationId((user: User) => user.dealer)
  dealerId?: string;

  @ManyToOne(() => Dealer, (dealer) => dealer.users, { nullable: true })
  @JoinColumn({ name: 'dealer_id', referencedColumnName: 'id' })
  dealer?: Dealer;

  @OneToMany(() => UserAddress, (address) => address.user, {
    cascade: ['insert'],
  })
  addresses: UserAddress[];

  @BeforeInsert()
  async setJoinedDate() {
    if (!this.joinedDate) {
      this.joinedDate = new Date();
    }
  }

  @BeforeInsert()
  async hashPassword() {
    const salt = await bcrypt.genSalt(HASH_SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
  }
}
