import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryFailedError } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { DUPLICATE_EMAIL_ERROR_CODE } from 'src/utils/constants.utils';
import { errorMessages } from 'src/utils/properties.utils';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      return await this.dataSource.transaction(
        async (transactionalEntityManager) => {
          const user = transactionalEntityManager.create(User, createUserDto);
          return await transactionalEntityManager.save(user);
        },
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).code === DUPLICATE_EMAIL_ERROR_CODE
      ) {
        throw new ConflictException(errorMessages.USER_EMAIL_EXISTS);
      }
      throw new InternalServerErrorException(
        errorMessages.USER_CREATION_FAILED,
      );
    }
  }
}
