import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { User } from 'src/users/entities/user.entity';
import { errorMessages } from 'src/utils/properties.utils';
import { Repository } from 'typeorm';
import { SignInDto } from './dto/signin-dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as argon2 from 'argon2';
import { parseDurationToSeconds } from 'src/utils/functions.utils';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    @InjectRedis() private redis: Redis,
    private refreshJwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signIn(signInDto: SignInDto) {
    const { email, password } = signInDto;

    try {
      const user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.password')
        .where('user.email = :email', { email })
        .getOne();

      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new UnauthorizedException(errorMessages.INVALID_CREDENTIALS);
      }
      const accessToken = await this.jwtService.signAsync({ sub: user.id });
      const refreshToken = await this.refreshJwtService.signAsync({
        sub: user.id,
      });
      await this.storeRefreshToken(user.id, refreshToken);
      return { accessToken, refreshToken };
    } catch (error) {
      console.log('error', error);
    }
  }

  async storeRefreshToken(userId: string, refreshToken: string) {
    const hashed = await argon2.hash(refreshToken);
    const ttlSeconds = parseDurationToSeconds(
      this.configService.get<string>('REFRESH_TOKEN_EXPIRED_IN', '7d'),
    );
    // Sliding expiry: 7 days TTL
    await this.redis.set(`refresh:user:${userId}`, hashed, 'EX', ttlSeconds);
  }

  async register(registerDto: CreateUserDto) {
    try {
      const { email, phoneNumber } = registerDto;

      const existingUser = await this.userRepository.findOne({
        where: [{ email }, { phoneNumber }],
      });

      if (existingUser) {
        if (existingUser.email === registerDto.email) {
          throw new ConflictException(errorMessages.EMAIL_ALREADY_EXISTS);
        }
        if (existingUser.phoneNumber === registerDto.phoneNumber) {
          throw new ConflictException(
            errorMessages.PHONE_NUMBER_ALREADY_EXISTS,
          );
        }
      }

      const user = this.userRepository.create(registerDto);

      const createdUser = await this.userRepository.save(user);

      return { user: createdUser };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        errorMessages.USER_CREATION_FAILED,
      );
    }
  }

  async refresh(userId: string, token: string) {
    const hashed = await this.redis.get(`refresh:user:${userId}`);
    if (!hashed) return { success: false, message: 'Refresh token expired' };

    const valid = await argon2.verify(hashed, token);
    if (!valid) return { success: false, message: 'Invalid token' };

    const accessToken = await this.jwtService.signAsync({ sub: userId });
    const refreshToken = await this.refreshJwtService.signAsync({
      sub: userId,
    });

    // Overwrite old token → sliding expiration
    await this.storeRefreshToken(userId, refreshToken);

    return { accessToken, refreshToken };
  }
}
