import { Brackets, SelectQueryBuilder } from 'typeorm';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { UserRole } from './enums/user-role';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface NormalizedPagination {
  page: number;
  limit: number;
  skip: number;
  searchTerm?: string;
}

export function normalizePagination(
  query: PaginationQueryDto = {},
): NormalizedPagination {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 10));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    searchTerm: query.searchTerm?.trim() || undefined,
  };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export function applySearchTerm<T>(
  qb: SelectQueryBuilder<T>,
  fields: string[],
  searchTerm?: string,
  paramName = 'searchTerm',
): void {
  if (!searchTerm || fields.length === 0) {
    return;
  }

  const term = `%${searchTerm}%`;
  qb.andWhere(
    new Brackets((subQb) => {
      fields.forEach((field, index) => {
        if (index === 0) {
          subQb.where(`${field} ILIKE :${paramName}`, { [paramName]: term });
          return;
        }

        subQb.orWhere(`${field} ILIKE :${paramName}`, { [paramName]: term });
      });
    }),
  );
}

export function orderItemsByIds<T extends { id?: string }>(
  items: T[],
  ids: string[],
): T[] {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  return ids
    .map((id) => itemMap.get(id))
    .filter((item): item is T => item !== undefined);
}

const USER_ROLE_PRIORITY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.WAREHOUSE_MANAGER]: 3,
  [UserRole.STAFF]: 4,
  [UserRole.DRIVER]: 5,
};

export function buildUserRolePrioritySql(alias = 'user'): string {
  const cases = Object.entries(USER_ROLE_PRIORITY)
    .map(([role, priority]) => `WHEN '${role}' THEN ${priority}`)
    .join(' ');

  return `CASE ${alias}.role ${cases} ELSE 6 END`;
}

export function applyUserRoleOrder<T>(
  qb: SelectQueryBuilder<T>,
  alias = 'user',
): void {
  qb.orderBy(buildUserRolePrioritySql(alias), 'ASC').addOrderBy(
    `${alias}.createdAt`,
    'DESC',
  );
}
