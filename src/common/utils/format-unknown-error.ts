import { QueryFailedError } from 'typeorm';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Serializes an unknown thrown value for terminal logs, including
 * TypeORM/Postgres driver fields when present.
 */
export function formatUnknownError(error: unknown, seen = new Set<unknown>()): string {
  if (error === undefined || error === null) {
    return String(error);
  }

  if (typeof error !== 'object') {
    return String(error);
  }

  if (seen.has(error)) {
    return '[Circular]';
  }
  seen.add(error);

  if (error instanceof QueryFailedError) {
    const driver = isRecord(error.driverError) ? error.driverError : {};
    const lines = [
      `${error.name}: ${error.message}`,
      `code: ${String(driver.code ?? (error as QueryFailedError & { code?: string }).code ?? 'n/a')}`,
    ];
    if (driver.detail) lines.push(`detail: ${String(driver.detail)}`);
    if (driver.constraint) lines.push(`constraint: ${String(driver.constraint)}`);
    if (driver.table) lines.push(`table: ${String(driver.table)}`);
    if (driver.column) lines.push(`column: ${String(driver.column)}`);
    if (driver.hint) lines.push(`hint: ${String(driver.hint)}`);
    if (error.stack) lines.push(error.stack);
    return lines.join('\n');
  }

  if (error instanceof Error) {
    const lines = [`${error.name}: ${error.message}`];
    if (error.stack) lines.push(error.stack);
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause !== undefined) {
      lines.push(`Caused by:\n${formatUnknownError(cause, seen)}`);
    }
    return lines.join('\n');
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
