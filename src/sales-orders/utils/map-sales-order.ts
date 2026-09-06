import { SalesOrderStatus } from 'src/common/utils/enums/sales-order.enum';
import { SalesOrder } from '../entities/sales-order.entity';

export type SalesOrderPartyView = {
  id: string;
  name: string;
};

export type ProductStockView = {
  quantityOnHand: number;
  quantityAllocated: number;
  availableQuantity: number;
};

export type SalesOrderDetailItemView = {
  id: string;
  quantity: number;
  quantityShipped: number;
  unitPrice: number;
  product: {
    id: string;
    name: string;
    sku: string;
    sellingPrice: number;
  } & ProductStockView;
};

export type SalesOrderDetailView = {
  id: string;
  status: SalesOrderStatus;
  createdAt?: Date;
  totalAmount: number;
  currency: string;
  shop: SalesOrderPartyView;
  warehouse: SalesOrderPartyView;
  items: SalesOrderDetailItemView[];
};

export type SalesOrderListView = {
  id: string;
  status: SalesOrderStatus;
  createdAt?: Date;
  totalAmount: number;
  currency: string;
  shop: SalesOrderPartyView;
  warehouse: SalesOrderPartyView;
  itemCount: number;
  quantity: number;
  quantityShipped: number;
};

function toParty(
  party?: { id: string; name: string } | null,
): SalesOrderPartyView {
  return {
    id: party?.id ?? '',
    name: party?.name ?? '',
  };
}

const EMPTY_STOCK: ProductStockView = {
  quantityOnHand: 0,
  quantityAllocated: 0,
  availableQuantity: 0,
};

const STATUSES_HOLDING_ALLOCATION: SalesOrderStatus[] = [
  SalesOrderStatus.APPROVED,
  SalesOrderStatus.PICKING,
  SalesOrderStatus.SHIPPED,
];

export function toSalesOrderDetail(
  so: SalesOrder,
  stockByProductId: Map<string, ProductStockView> = new Map(),
): SalesOrderDetailView {
  const holdsAllocation = STATUSES_HOLDING_ALLOCATION.includes(so.status);

  return {
    id: so.id,
    status: so.status,
    createdAt: so.createdAt,
    totalAmount: Number(so.totalAmount ?? 0),
    currency: so.currency,
    shop: toParty(so.shop),
    warehouse: toParty(so.warehouse),
    items: (so.items ?? []).map((item) => {
      const productId = item.product?.id ?? item.productId;
      const stock = stockByProductId.get(productId) ?? EMPTY_STOCK;
      const reservedHere = holdsAllocation ? item.quantity : 0;

      return {
        id: item.id,
        quantity: item.quantity,
        quantityShipped: item.quantityShipped,
        unitPrice: Number(item.unitPrice ?? 0),
        product: {
          id: productId,
          name: item.product?.name ?? '',
          sku: item.product?.sku ?? '',
          sellingPrice: Number(item.product?.sellingPrice ?? 0),
          quantityOnHand: stock.quantityOnHand,
          quantityAllocated: Math.max(0, stock.quantityAllocated - reservedHere),
          availableQuantity: stock.availableQuantity + reservedHere,
        },
      };
    }),
  };
}

export function toSalesOrderListItem(so: SalesOrder): SalesOrderListView {
  const items = so.items ?? [];

  return {
    id: so.id,
    status: so.status,
    createdAt: so.createdAt,
    totalAmount: Number(so.totalAmount ?? 0),
    currency: so.currency,
    shop: toParty(so.shop),
    warehouse: toParty(so.warehouse),
    itemCount: items.length,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    quantityShipped: items.reduce((sum, item) => sum + item.quantityShipped, 0),
  };
}
