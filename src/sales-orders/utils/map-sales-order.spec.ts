import { SalesOrderStatus } from 'src/common/utils/enums/sales-order.enum';
import { SalesOrder } from '../entities/sales-order.entity';
import { toSalesOrderDetail } from './map-sales-order';

describe('toSalesOrderDetail', () => {
  const stockByProductId = new Map([
    [
      'product-1',
      {
        quantityOnHand: 24,
        quantityAllocated: 14,
        availableQuantity: 10,
      },
    ],
  ]);

  const order = {
    id: 'so-1',
    status: SalesOrderStatus.APPROVED,
    createdAt: new Date('2026-09-06T00:00:00.000Z'),
    totalAmount: 120,
    currency: 'LKR',
    shop: { id: 'shop-1', name: 'Shop' },
    warehouse: { id: 'wh-1', name: 'Main' },
    items: [
      {
        id: 'item-1',
        quantity: 6,
        quantityShipped: 0,
        unitPrice: 20,
        productId: 'product-1',
        product: {
          id: 'product-1',
          name: 'Rice',
          sku: 'RICE',
          sellingPrice: 20,
        },
      },
    ],
  } as SalesOrder;

  it('adds this order reservation back to available quantity after approve', () => {
    const detail = toSalesOrderDetail(order, stockByProductId);

    expect(detail.items[0].product.quantityOnHand).toBe(24);
    expect(detail.items[0].product.quantityAllocated).toBe(8);
    expect(detail.items[0].product.availableQuantity).toBe(16);
  });

  it('does not add reservation back while the order is still pending', () => {
    const detail = toSalesOrderDetail(
      { ...order, status: SalesOrderStatus.PENDING },
      stockByProductId,
    );

    expect(detail.items[0].product.quantityAllocated).toBe(14);
    expect(detail.items[0].product.availableQuantity).toBe(10);
  });
});
