import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { AUTH_COOKIE_NAMES } from '../auth-cookie.utils';
import { errorMessages } from 'src/utils/properties.utils';
import { AuthJwtPayload } from '../types/jwt-payload';
import { ACCESS_JWT } from '../jwt.constants';
import { User } from 'src/users/entities/user.entity';
import { DealerStatus } from 'src/common/utils/enums/dealer.enum';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_JWT) private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[AUTH_COOKIE_NAMES.accessToken];

    if (!token) {
      throw new UnauthorizedException(errorMessages.TOKEN_EXPIRED);
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthJwtPayload>(token);
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['dealer'],
      });

      if (!user) {
        throw new UnauthorizedException(errorMessages.TOKEN_EXPIRED);
      }

      if (
        user.dealer &&
        user.dealer.status !== DealerStatus.ACTIVE
      ) {
        throw new UnauthorizedException(errorMessages.INACTIVE_ACCOUNT);
      }

      (request as Request & { user: AuthJwtPayload }).user = {
        sub: user.id,
        dealerId: user.dealerId ?? user.dealer?.id ?? null,
        role: user.role,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(errorMessages.TOKEN_EXPIRED);
    }
  }
}
