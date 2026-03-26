import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { Repository, DataSource, QueryFailedError } from 'typeorm';
import { User } from './entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { ConflictException } from '@nestjs/common';
import { DUPLICATE_EMAIL_ERROR_CODE } from 'src/utils/constants.utils';

describe('UsersService', () => {
  let service: UsersService;
  let mockUsersRepository: MockRepository<User>;
  let mockDataSource: MockDataSource;

  type MockRepository<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;
  type MockDataSource = Partial<Record<keyof DataSource, jest.Mock>>;

  const mockRepositoryFactory = () => ({
    create: jest.fn(),
    save: jest.fn(),
  });

  const mockDataSourceFactory = () => ({
    transaction: jest.fn(async (callback) => {
      return callback({
        create: mockUsersRepository.create,
        save: mockUsersRepository.save,
      });
    }),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useFactory: mockRepositoryFactory,
        },
        { provide: DataSource, useFactory: mockDataSourceFactory },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    mockUsersRepository = module.get<MockRepository<User>>(
      getRepositoryToken(User),
    );
    mockDataSource = module.get<MockDataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a user successfully', async () => {
    const createUserDto: CreateUserDto = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: '1234567890',
      addresses: [],
      password: 'securepassword',
    };

    const expectedUser = { id: 'some-uuid', ...createUserDto } as User;
    mockUsersRepository.create.mockReturnValue(expectedUser);
    mockUsersRepository.save.mockResolvedValue(expectedUser);

    const result = await service.create(createUserDto);

    expect(result).toEqual(expectedUser);
    expect(mockDataSource.transaction).toHaveBeenCalled();
    expect(mockUsersRepository.create).toHaveBeenCalledWith(
      User,
      createUserDto,
    );
    expect(mockUsersRepository.save).toHaveBeenCalledWith(expectedUser);
  });

  it('should throw a ConflictException for a duplicate email', async () => {
    const createUserDto: CreateUserDto = {
      email: 'existing@example.com',
      password: 'hashed_password',
      firstName: 'Existing User',
      lastName: 'User',
      phoneNumber: '0987654321',
      addresses: [],
    };

    const duplicateEmailError = new QueryFailedError(
      'query',
      [],
      new Error('detail'),
    );
    (duplicateEmailError as any).code = DUPLICATE_EMAIL_ERROR_CODE;

    // Mock the save method to reject the promise with the specific error
    mockUsersRepository.save.mockRejectedValue(duplicateEmailError);

    await expect(service.create(createUserDto)).rejects.toThrow(
      ConflictException,
    );
    await expect(service.create(createUserDto)).rejects.toThrow(
      'A user with this email already exists.',
    );

    expect(mockDataSource.transaction).toHaveBeenCalled();
    expect(mockUsersRepository.save).toHaveBeenCalled();
  });
});
