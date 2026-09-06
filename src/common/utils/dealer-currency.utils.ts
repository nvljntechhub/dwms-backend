import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Dealer } from 'src/dealers/entities/dealer.entity';
import { errorMessages } from 'src/utils/properties.utils';

export async function resolveDealerCurrency(
  dealerRepository: Pick<Repository<Dealer>, 'findOne'>,
  dealerId: string,
): Promise<string> {
  const dealer = await dealerRepository.findOne({
    where: { id: dealerId },
    select: ['id', 'currency'],
  });

  if (!dealer) {
    throw new NotFoundException(errorMessages.DEALER_NOT_FOUND);
  }

  return dealer.currency;
}
