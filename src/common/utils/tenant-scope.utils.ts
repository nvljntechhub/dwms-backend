import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { errorMessages } from 'src/utils/properties.utils';

export function requireDealerId(dealerId?: string | null): string {
  if (!dealerId) {
    throw new ForbiddenException(errorMessages.ACCESS_DENIED);
  }
  return dealerId;
}

export function assertTenantMatch(
  resourceDealerId: string | null | undefined,
  requestDealerId: string,
): void {
  if (resourceDealerId !== requestDealerId) {
    throw new NotFoundException(errorMessages.USER_NOT_FOUND);
  }
}
