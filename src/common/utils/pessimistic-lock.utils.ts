import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';

export async function lockEntityById<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  id: string,
): Promise<T | null> {
  return manager
    .getRepository(entity)
    .createQueryBuilder('row')
    .setLock('pessimistic_write')
    .where('row.id = :id', { id })
    .getOne();
}
