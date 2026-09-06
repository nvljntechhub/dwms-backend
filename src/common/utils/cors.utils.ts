const PRIVATE_IPV4 =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/;

export function parseAllowedOrigins(frontendUrl?: string): string[] {
  return (frontendUrl ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowedOrigins: string[],
  isProduction: boolean,
): boolean {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (isProduction) {
    return false;
  }

  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      PRIVATE_IPV4.test(hostname)
    );
  } catch {
    return false;
  }
}
