import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthJwtPayload } from '../types/jwt-payload';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthJwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthJwtPayload }>();
    return request.user;
  },
);
