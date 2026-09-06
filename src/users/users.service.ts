import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource, QueryFailedError } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DUPLICATE_EMAIL_ERROR_CODE } from 'src/utils/constants.utils';
import { errorMessages } from 'src/utils/properties.utils';
import { UserAddress } from 'src/user-addresses/entities/user-address.entity';
import * as bcrypt from 'bcrypt';
import { HASH_SALT_ROUNDS } from 'src/config/hash.config';
import { formatUnknownError } from 'src/common/utils/format-unknown-error';
import { UserRole } from 'src/common/utils/enums/user-role';
import { Dealer } from 'src/dealers/entities/dealer.entity';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import {
  applySearchTerm,
  applyUserRoleOrder,
  buildPaginatedResult,
  buildUserRolePrioritySql,
  normalizePagination,
  orderItemsByIds,
  PaginatedResult,
} from 'src/common/utils/pagination.utils';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  private requireDealerId(dealerId?: string | null): string {
    if (!dealerId) {
      throw new ForbiddenException(errorMessages.ACCESS_DENIED);
    }
    return dealerId;
  }

  async create(createUserDto: CreateUserDto, dealerId?: string): Promise<User> {
    const scopedDealerId = this.requireDealerId(dealerId);

    try {
      return await this.dataSource.transaction(
        async (transactionalEntityManager) => {
          const { addresses = [], role, ...userFields } = createUserDto;

          if (role === UserRole.SUPER_ADMIN) {
            throw new ForbiddenException(errorMessages.ACCESS_DENIED);
          }

          const user = transactionalEntityManager.create(User, {
            ...userFields,
            role: role ?? UserRole.STAFF,
            dealer: { id: scopedDealerId } as Dealer,
          });
          user.addresses = addresses.map((address) =>
            transactionalEntityManager.create(UserAddress, address),
          );

          return await transactionalEntityManager.save(user);
        },
      );
    } catch (error) {
      this.logger.error(
        `User creation failed:\n${formatUnknownError(error)}`,
      );

      if (error instanceof ForbiddenException) {
        throw error;
      }
      if (
        error instanceof QueryFailedError &&
        (error as any).code === DUPLICATE_EMAIL_ERROR_CODE
      ) {
        throw new ConflictException(errorMessages.USER_EMAIL_EXISTS);
      }
      throw new InternalServerErrorException(
        errorMessages.USER_CREATION_FAILED,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  async findAll(
    dealerId?: string | null,
    query: PaginationQueryDto = {},
  ): Promise<PaginatedResult<User>> {
    const scopedDealerId = this.requireDealerId(dealerId);
    const { page, limit, skip, searchTerm } = normalizePagination(query);

    const qb = this.usersRepository
      .createQueryBuilder('user')
      .where('user.dealer_id = :dealerId', { dealerId: scopedDealerId });

    if (searchTerm) {
      qb.leftJoin('user.addresses', 'addresses');
      applySearchTerm(
        qb,
        [
          'user.firstName',
          'user.lastName',
          'user.email',
          'user.phoneNumber',
          'CAST(user.role AS text)',
          'addresses.label',
          'addresses.city',
        ],
        searchTerm,
      );
    }

    const total = await qb.clone().distinct(true).getCount();
    const idQuery = qb
      .clone()
      .select('user.id', 'id')
      .addSelect(buildUserRolePrioritySql('user'))
      .addSelect('user.createdAt')
      .distinct(true);
    applyUserRoleOrder(idQuery);
    const idRows = await idQuery
      .offset(skip)
      .limit(limit)
      .getRawMany<{ id: string }>();

    if (!idRows.length) {
      return buildPaginatedResult([], total, page, limit);
    }

    const ids = idRows.map((row) => row.id);
    const items = await this.usersRepository.find({
      where: { id: In(ids) },
      relations: ['addresses'],
    });

    return buildPaginatedResult(
      orderItemsByIds(items, ids),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string, dealerId?: string | null): Promise<User> {
    const scopedDealerId = this.requireDealerId(dealerId);

    const user = await this.usersRepository.findOne({
      where: { id, dealer: { id: scopedDealerId } },
      relations: ['addresses'],
    });

    if (!user) {
      throw new NotFoundException(errorMessages.USER_NOT_FOUND);
    }

    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    dealerId?: string | null,
  ): Promise<User> {
    await this.findOne(id, dealerId);

    const { addresses, ...userFields } = updateUserDto;

    const updatePayload: Partial<User> = Object.fromEntries(
      Object.entries(userFields).filter(([, value]) => value !== undefined),
    );

    if (updatePayload.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(errorMessages.ACCESS_DENIED);
    }

    try {
      if (updatePayload.password) {
        const salt = await bcrypt.genSalt(HASH_SALT_ROUNDS);
        updatePayload.password = await bcrypt.hash(
          updatePayload.password,
          salt,
        );
      }

      await this.dataSource.transaction(async (manager) => {
        if (Object.keys(updatePayload).length > 0) {
          await manager.update(User, id, updatePayload);
        }

        // When addresses is sent, replace all existing addresses for the user
        if (addresses !== undefined) {
          await manager
            .createQueryBuilder()
            .delete()
            .from(UserAddress)
            .where('user_id = :id', { id })
            .execute();

          if (addresses.length > 0) {
            const addressEntities = addresses.map((address) =>
              manager.create(UserAddress, {
                ...address,
                user: { id } as User,
              }),
            );
            await manager.save(addressEntities);
          }
        }
      });

      return this.findOne(id, dealerId);
    } catch (error) {
      this.logger.error(
        `User update failed:\n${formatUnknownError(error)}`,
      );

      if (
        error instanceof QueryFailedError &&
        (error as any).code === DUPLICATE_EMAIL_ERROR_CODE
      ) {
        throw new ConflictException(errorMessages.USER_EMAIL_EXISTS);
      }
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(errorMessages.USER_UPDATE_FAILED, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async remove(id: string, dealerId?: string | null): Promise<void> {
    await this.findOne(id, dealerId);

    try {
      await this.dataSource.transaction(async (manager) => {
        await manager
          .createQueryBuilder()
          .delete()
          .from(UserAddress)
          .where('user_id = :id', { id })
          .execute();
        await manager.delete(User, id);
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `User delete failed:\n${formatUnknownError(error)}`,
      );
      throw new InternalServerErrorException(errorMessages.USER_DELETE_FAILED, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
