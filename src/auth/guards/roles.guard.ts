import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthJwtPayload } from '../types/jwt-payload';
import { UserRole } from 'src/common/utils/enums/user-role';
import { errorMessages } from 'src/utils/properties.utils';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: AuthJwtPayload }>();
    const user = request.user;

    if (!user?.role) {
      throw new ForbiddenException(errorMessages.PERMISSION_DENIED);
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(errorMessages.PERMISSION_DENIED);
    }

    return true;
  }
}
