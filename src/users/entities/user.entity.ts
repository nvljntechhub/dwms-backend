import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { HASH_SALT_ROUNDS } from 'src/config/hash.config';
import { UserRole } from 'src/common/utils/enums/user-role';
import { UserAddress } from 'src/user-addresses/entities/user-address.entity';
import { BaseEntity } from 'src/common/utils/BaseEntity';

@Entity()
export class User extends BaseEntity {
  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  phoneNumber: string;

  @Column({ select: false })
  password: string;

  @Column({ nullable: true })
  profileURL: string;

  @Column({ type: 'date' })
  joinedDate: Date;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt?: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt?: Date;

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
