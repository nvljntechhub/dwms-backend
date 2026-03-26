export enum PaymentProvider {
  STRIPE = 'stripe',
  CASH = 'cash',
  CARD = 'card',
  CUSTOM = 'custom',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}
