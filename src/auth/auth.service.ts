import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RegisterDto } from './dto/register.dto';
import { User } from 'src/users/entities/user.entity';
import { Dealer } from 'src/dealers/entities/dealer.entity';
import { UserRole } from 'src/common/utils/enums/user-role';
import { errorMessages } from 'src/utils/properties.utils';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { DUPLICATE_EMAIL_ERROR_CODE } from 'src/utils/constants.utils';
import { SignInDto } from './dto/signin-dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { parseDurationToSeconds } from 'src/utils/functions.utils';
import { HASH_SALT_ROUNDS } from 'src/config/hash.config';
import type { SignOptions } from 'jsonwebtoken';
import { formatUnknownError } from 'src/common/utils/format-unknown-error';
import {
  DEFAULT_WAREHOUSE_NAME,
  Warehouse,
} from 'src/warehouses/entities/warehouse.entity';
import { ACCESS_JWT, REFRESH_JWT } from './jwt.constants';
import { DealerStatus } from 'src/common/utils/enums/dealer.enum';

type PasswordResetPayload = {
  sub: string;
  email: string;
  purpose: string;
  jti: string;
};

type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: UserRole;
  dealerId: string | null;
  currency: string | null;
  warehouse?: {
    id: string;
    name: string;
    isDefault: boolean;
  };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Dealer)
    private readonly dealerRepository: Repository<Dealer>,
    private readonly dataSource: DataSource,
    @Inject(ACCESS_JWT) private readonly jwtService: JwtService,
    @InjectRedis() private redis: Redis,
    @Inject(REFRESH_JWT) private readonly refreshJwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private passwordResetRedisKey(userId: string) {
    return `password-reset:user:${userId}`;
  }

  private authTokenPayload(user: {
    id?: string;
    dealerId?: string | null;
    role?: UserRole;
  }) {
    return {
      sub: user.id,
      dealerId: user.dealerId ?? null,
      role: user.role ?? null,
    };
  }

  private toAuthUser(
    user: User,
    extra?: {
      dealerId?: string;
      currency?: string;
      warehouse?: AuthUser["warehouse"];
    },
  ): AuthUser {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role: user.role,
      dealerId: extra?.dealerId ?? user.dealerId ?? user.dealer?.id ?? null,
      currency: extra?.currency ?? user.dealer?.currency ?? null,
      ...(extra?.warehouse ? { warehouse: extra.warehouse } : {}),
    };
  }

  private async issueAuthTokens(user: {
    id?: string;
    dealerId?: string | null;
    role?: UserRole;
  }) {
    if (!user.id) {
      throw new InternalServerErrorException(
        errorMessages.USER_CREATION_FAILED,
      );
    }

    const payload = this.authTokenPayload(user);
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.refreshJwtService.signAsync({
      sub: user.id,
      dealerId: user.dealerId ?? null,
    });
    await this.storeRefreshToken(user.id, refreshToken);
    return { accessToken, refreshToken };
  }

  private dealerIdOf(user: User): string | null {
    return user.dealerId ?? user.dealer?.id ?? null;
  }

  private assertDealerIsActive(user: User): void {
    if (user.dealer && user.dealer.status !== DealerStatus.ACTIVE) {
      throw new UnauthorizedException(errorMessages.INACTIVE_ACCOUNT);
    }
  }

  async verifyPassword(userId: string, password: string): Promise<{ verified: true }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.dealer', 'dealer')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException(errorMessages.INVALID_CREDENTIALS);
    }

    this.assertDealerIsActive(user);

    return { verified: true };
  }

  async signIn(signInDto: SignInDto) {
    const { email, password } = signInDto;

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.dealer', 'dealer')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException(errorMessages.INVALID_CREDENTIALS);
    }

    this.assertDealerIsActive(user);

    const { accessToken, refreshToken } = await this.issueAuthTokens({
      id: user.id,
      dealerId: this.dealerIdOf(user),
      role: user.role,
    });
    return {
      accessToken,
      refreshToken,
      user: this.toAuthUser(user, { dealerId: this.dealerIdOf(user) ?? undefined }),
    };
  }

  async storeRefreshToken(userId: string, refreshToken: string) {
    const hashed = await argon2.hash(refreshToken);
    const ttlSeconds = parseDurationToSeconds(
      this.configService.get<string>("REFRESH_TOKEN_EXPIRED_IN", "7d"),
    );
    // Sliding expiry: 7 days TTL
    await this.redis.set(`refresh:user:${userId}`, hashed, "EX", ttlSeconds);
  }

  async generateEmailVerificationToken(
    userId: string,
    email: string,
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, email, purpose: "email_verification" },
      {
        secret: this.configService.get<string>("EMAIL_VERIFICATION_SECRET"),
        expiresIn: this.configService.get<string>(
          "EMAIL_VERIFICATION_EXPIRED_IN",
          "15m",
        ) as SignOptions["expiresIn"],
      },
    );
  }

  async generatePasswordResetToken(
    userId: string,
    email: string,
  ): Promise<string> {
    const jti = randomUUID();
    const expiresIn = this.configService.get<string>(
      "PASSWORD_RESET_EXPIRED_IN",
      "15m",
    );
    const ttlSeconds = parseDurationToSeconds(expiresIn);

    const token = await this.jwtService.signAsync(
      { sub: userId, email, purpose: "password_reset", jti },
      {
        secret: this.configService.get<string>("PASSWORD_RESET_SECRET"),
        expiresIn: expiresIn as SignOptions["expiresIn"],
      },
    );

    // Latest request wins; older links become invalid
    await this.redis.set(
      this.passwordResetRedisKey(userId),
      jti,
      "EX",
      ttlSeconds,
    );

    return token;
  }

  /**
   * Looks up the user by email. Returns null when no account exists
   * so the controller can always respond with the same message.
   */
  async findUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  private async verifyPasswordResetToken(
    token: string,
  ): Promise<PasswordResetPayload> {
    let payload: PasswordResetPayload;

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>("PASSWORD_RESET_SECRET"),
      });
    } catch {
      throw new UnauthorizedException(errorMessages.RESET_TOKEN_INVALID);
    }

    if (payload.purpose !== "password_reset" || !payload.jti) {
      throw new UnauthorizedException(errorMessages.RESET_TOKEN_INVALID);
    }

    const storedJti = await this.redis.get(
      this.passwordResetRedisKey(payload.sub),
    );
    if (!storedJti || storedJti !== payload.jti) {
      throw new UnauthorizedException(errorMessages.RESET_TOKEN_INVALID);
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub, email: payload.email },
    });

    if (!user) {
      throw new UnauthorizedException(errorMessages.RESET_TOKEN_INVALID);
    }

    return payload;
  }

  async validatePasswordResetToken(token: string): Promise<void> {
    await this.verifyPasswordResetToken(token);
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const payload = await this.verifyPasswordResetToken(token);

    const salt = await bcrypt.genSalt(HASH_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    await this.userRepository.update(payload.sub, { password: hashedPassword });

    // One-time use + force re-login on other sessions
    await this.redis.del(this.passwordResetRedisKey(payload.sub));
    await this.redis.del(`refresh:user:${payload.sub}`);
  }

  async verifyEmail(token: string) {
    let payload: { sub: string; email: string; purpose: string };

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>("EMAIL_VERIFICATION_SECRET"),
      });
    } catch {
      throw new UnauthorizedException(errorMessages.TOKEN_EXPIRED);
    }

    if (payload.purpose !== "email_verification") {
      throw new UnauthorizedException(errorMessages.TOKEN_EXPIRED);
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub, email: payload.email },
    });

    if (!user) {
      throw new UnauthorizedException(errorMessages.TOKEN_EXPIRED);
    }

    if (!user.isVerified) {
      user.isVerified = true;
      await this.userRepository.save(user);
    }

    return user;
  }

  async registerDealer(registerDto: RegisterDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }> {
    try {
      const { dealer: dealerDto, ...userFields } = registerDto;
      const { email, phoneNumber } = userFields;

      const existingUser = await this.userRepository.findOne({
        where: phoneNumber ? [{ email }, { phoneNumber }] : [{ email }],
      });

      if (existingUser) {
        if (existingUser.email === email) {
          throw new ConflictException(errorMessages.EMAIL_ALREADY_EXISTS);
        }
        if (phoneNumber && existingUser.phoneNumber === phoneNumber) {
          throw new ConflictException(
            errorMessages.PHONE_NUMBER_ALREADY_EXISTS,
          );
        }
      }

      const existingDealer = await this.dealerRepository.findOne({
        where: { email: dealerDto.email },
      });

      if (existingDealer) {
        throw new ConflictException(errorMessages.DEALER_EMAIL_EXISTS);
      }

      const { savedUser, savedDealer, savedWarehouse } =
        await this.dataSource.transaction(async (manager) => {
          const dealer = manager.create(Dealer, {
            name: dealerDto.name,
            email: dealerDto.email,
            taxId: dealerDto.taxId,
          });
          const savedDealer = await manager.save(Dealer, dealer);

          const user = manager.create(User, {
            ...userFields,
            role: UserRole.SUPER_ADMIN,
            dealer: savedDealer,
            isVerified: true,
            joinedDate: new Date(),
          });
          const savedUser = await manager.save(User, user);

          const warehouse = manager.create(Warehouse, {
            name: DEFAULT_WAREHOUSE_NAME,
            isDefault: true,
            dealer: savedDealer,
          });
          const savedWarehouse = await manager.save(Warehouse, warehouse);

          return { savedUser, savedDealer, savedWarehouse };
        });

      delete savedUser.password;

      const { accessToken, refreshToken } = await this.issueAuthTokens({
        id: savedUser.id,
        dealerId: savedDealer.id,
        role: savedUser.role,
      });

      return {
        accessToken,
        refreshToken,
        user: this.toAuthUser(savedUser, {
          dealerId: savedDealer.id,
          currency: savedDealer.currency,
          warehouse: {
            id: savedWarehouse.id,
            name: savedWarehouse.name,
            isDefault: savedWarehouse.isDefault,
          },
        }),
      };
    } catch (error) {
      this.logger.error(
        `Dealer registration failed:\n${formatUnknownError(error)}`,
      );

      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      if (
        error instanceof QueryFailedError &&
        (error as any).code === DUPLICATE_EMAIL_ERROR_CODE
      ) {
        throw new ConflictException(errorMessages.EMAIL_ALREADY_EXISTS);
      }

      throw new InternalServerErrorException(
        errorMessages.USER_CREATION_FAILED,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };

    try {
      payload = await this.refreshJwtService.verifyAsync<{ sub: string }>(
        refreshToken,
      );
    } catch {
      throw new UnauthorizedException(errorMessages.TOKEN_EXPIRED);
    }

    const hashed = await this.redis.get(`refresh:user:${payload.sub}`);
    if (!hashed) {
      throw new UnauthorizedException(errorMessages.TOKEN_EXPIRED);
    }

    const valid = await argon2.verify(hashed, refreshToken);
    if (!valid) {
      throw new UnauthorizedException(errorMessages.TOKEN_EXPIRED);
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: ['dealer'],
    });

    if (!user) {
      throw new UnauthorizedException(errorMessages.TOKEN_EXPIRED);
    }

    this.assertDealerIsActive(user);

    return this.issueAuthTokens({
      id: user.id,
      dealerId: this.dealerIdOf(user),
      role: user.role,
    });
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    try {
      const payload = await this.refreshJwtService.verifyAsync<{ sub: string }>(
        refreshToken,
      );
      await this.redis.del(`refresh:user:${payload.sub}`);
    } catch {
      // Invalid or expired token — cookies are still cleared
    }
  }
}
