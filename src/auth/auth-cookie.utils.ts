import { ConfigService } from '@nestjs/config';
import { CookieOptions, Response } from 'express';
import { parseDurationToSeconds } from 'src/utils/functions.utils';

export const AUTH_COOKIE_NAMES = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
} as const;

function getAuthCookieOptions(
  configService: ConfigService,
  maxAgeSeconds: number,
): CookieOptions {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: maxAgeSeconds * 1000,
    path: '/',
  };
}

export function setAuthCookies(
  response: Response,
  configService: ConfigService,
  tokens: { accessToken: string; refreshToken: string },
): void {
  const accessMaxAge = parseDurationToSeconds(
    configService.get<string>('ACCESS_TOKEN_EXPIRED_IN', '15m'),
  );
  const refreshMaxAge = parseDurationToSeconds(
    configService.get<string>('REFRESH_TOKEN_EXPIRED_IN', '7d'),
  );

  response.cookie(
    AUTH_COOKIE_NAMES.accessToken,
    tokens.accessToken,
    getAuthCookieOptions(configService, accessMaxAge),
  );
  response.cookie(
    AUTH_COOKIE_NAMES.refreshToken,
    tokens.refreshToken,
    getAuthCookieOptions(configService, refreshMaxAge),
  );
}

export function clearAuthCookies(
  response: Response,
  configService: ConfigService,
): void {
  const clearOptions: CookieOptions = {
    httpOnly: true,
    secure: configService.get<string>('NODE_ENV') === 'production',
    sameSite:
      configService.get<string>('NODE_ENV') === 'production' ? 'none' : 'lax',
    path: '/',
  };

  response.clearCookie(AUTH_COOKIE_NAMES.accessToken, clearOptions);
  response.clearCookie(AUTH_COOKIE_NAMES.refreshToken, clearOptions);
}
