export const HASH_SALT_ROUNDS = parseInt(
  process.env.HASH_SALT_ROUNDS || '10',
  10,
);
