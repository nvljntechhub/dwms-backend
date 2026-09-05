import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { Repository, DataSource, QueryFailedError } from 'typeorm';
import { User } from './entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { errorMessages } from 'src/utils/properties.utils';
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
    find: jest.fn(),
    findOne: jest.fn(),
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

    const result = await service.create(createUserDto, 'dealer-uuid');

    expect(result).toEqual(expectedUser);
    expect(mockDataSource.transaction).toHaveBeenCalled();
    expect(mockUsersRepository.create).toHaveBeenCalledWith(User, {
      email: createUserDto.email,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      phoneNumber: createUserDto.phoneNumber,
      password: createUserDto.password,
      role: 'STAFF',
      dealer: { id: 'dealer-uuid' },
    });
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

    mockUsersRepository.create.mockReturnValue({} as User);
    mockUsersRepository.save.mockRejectedValue(duplicateEmailError);

    await expect(service.create(createUserDto, 'dealer-uuid')).rejects.toThrow(
      ConflictException,
    );
    await expect(service.create(createUserDto, 'dealer-uuid')).rejects.toThrow(
      errorMessages.USER_EMAIL_EXISTS,
    );

    expect(mockDataSource.transaction).toHaveBeenCalled();
    expect(mockUsersRepository.save).toHaveBeenCalled();
  });

  it('should list only users for the given dealer', async () => {
    const dealerUsers = [{ id: 'u1' }] as User[];
    mockUsersRepository.find.mockResolvedValue(dealerUsers);

    const result = await service.findAll('dealer-uuid');

    expect(result).toEqual(dealerUsers);
    expect(mockUsersRepository.find).toHaveBeenCalledWith({
      where: { dealer: { id: 'dealer-uuid' } },
      relations: ['addresses'],
      order: { createdAt: 'DESC' },
    });
  });

  it('should reject listing users without a dealer id', async () => {
    await expect(service.findAll(null)).rejects.toThrow(ForbiddenException);
  });

  it('should find one user scoped to the dealer', async () => {
    const user = { id: 'u1' } as User;
    mockUsersRepository.findOne.mockResolvedValue(user);

    const result = await service.findOne('u1', 'dealer-uuid');

    expect(result).toEqual(user);
    expect(mockUsersRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'u1', dealer: { id: 'dealer-uuid' } },
      relations: ['addresses'],
    });
  });

  it('should throw NotFoundException when the user is not in the dealer', async () => {
    mockUsersRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne('u1', 'dealer-uuid')).rejects.toThrow(
      NotFoundException,
    );
  });
});
