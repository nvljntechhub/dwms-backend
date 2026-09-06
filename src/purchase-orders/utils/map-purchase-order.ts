import { PurchaseOrderStatus } from 'src/common/utils/enums/purchase-order.enum';
import { PurchaseOrder } from '../entities/purchase-order.entity';

export type PurchaseOrderPartyView = {
  id: string;
  name: string;
};

export type PurchaseOrderDetailItemView = {
  id: string;
  quantityOrdered: number;
  quantityReceived: number;
  product: {
    id: string;
    name: string;
    sku: string;
    costPrice: number;
  };
};

export type PurchaseOrderDetailView = {
  id: string;
  status: PurchaseOrderStatus;
  createdAt?: Date;
  submittedAt?: Date | null;
  manufacturer: PurchaseOrderPartyView;
  warehouse: PurchaseOrderPartyView;
  items: PurchaseOrderDetailItemView[];
};

export type PurchaseOrderListView = {
  id: string;
  status: PurchaseOrderStatus;
  createdAt?: Date;
  submittedAt?: Date | null;
  manufacturer: PurchaseOrderPartyView;
  warehouse: PurchaseOrderPartyView;
  itemCount: number;
  quantityOrdered: number;
  quantityReceived: number;
};

function toParty(
  party?: { id: string; name: string } | null,
): PurchaseOrderPartyView {
  return {
    id: party?.id ?? '',
    name: party?.name ?? '',
  };
}

export function toPurchaseOrderDetail(
  po: PurchaseOrder,
): PurchaseOrderDetailView {
  return {
    id: po.id,
    status: po.status,
    createdAt: po.createdAt,
    submittedAt: po.submittedAt ?? null,
    manufacturer: toParty(po.manufacturer),
    warehouse: toParty(po.warehouse),
    items: (po.items ?? []).map((item) => ({
      id: item.id,
      quantityOrdered: item.quantityOrdered,
      quantityReceived: item.quantityReceived,
      product: {
        id: item.product?.id ?? item.productId,
        name: item.product?.name ?? '',
        sku: item.product?.sku ?? '',
        costPrice: Number(item.product?.costPrice ?? 0),
      },
    })),
  };
}

export function toPurchaseOrderListItem(
  po: PurchaseOrder,
): PurchaseOrderListView {
  const items = po.items ?? [];

  return {
    id: po.id,
    status: po.status,
    createdAt: po.createdAt,
    submittedAt: po.submittedAt ?? null,
    manufacturer: toParty(po.manufacturer),
    warehouse: toParty(po.warehouse),
    itemCount: items.length,
    quantityOrdered: items.reduce((sum, item) => sum + item.quantityOrdered, 0),
    quantityReceived: items.reduce(
      (sum, item) => sum + item.quantityReceived,
      0,
    ),
  };
}
