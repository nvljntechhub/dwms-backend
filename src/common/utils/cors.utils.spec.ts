import { isAllowedCorsOrigin, parseAllowedOrigins } from './cors.utils';

describe('cors.utils', () => {
  it('parses comma-separated frontend URLs', () => {
    expect(parseAllowedOrigins('http://localhost:3000, http://172.20.10.3:3000')).toEqual([
      'http://localhost:3000',
      'http://172.20.10.3:3000',
    ]);
  });

  it('allows configured origins in production', () => {
    expect(
      isAllowedCorsOrigin('http://localhost:3000', ['http://localhost:3000'], true),
    ).toBe(true);
  });

  it('rejects unknown origins in production', () => {
    expect(
      isAllowedCorsOrigin('http://172.20.10.3:3000', ['http://localhost:3000'], true),
    ).toBe(false);
  });

  it('allows private LAN origins in development', () => {
    expect(
      isAllowedCorsOrigin('http://172.20.10.3:3000', ['http://localhost:3000'], false),
    ).toBe(true);
  });
});
