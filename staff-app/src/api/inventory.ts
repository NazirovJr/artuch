import { ApiError, apiFetch } from './client';

export interface InventoryItem {
  id: string;
  name: string;
  price: number;
  purchasePrice: number;
  category: string;
  barcode?: string;
  stock: number;
  minStock: number;
  parLevel: number;
  reorderPoint: number;
  unit: string;
  soldCount: number;
  isDraft: boolean;
  pricePerLiter?: number;
  mlPerServing?: number;
  isActive: boolean;
  warehouseId?: string;
  /** FK to warehouse_items.id — if set, POS sales also deduct from this warehouse SKU */
  warehouseItemId?: string;
  isRentable: boolean;
  rentalPricePerDay?: number;
  rentedQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export function getInventoryItems(category?: string): Promise<InventoryItem[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiFetch<InventoryItem[]>(`/inventory${query}`);
}

export function getInventoryItem(id: string): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(`/inventory/${id}`);
}

export function updateInventoryItem(
  id: string,
  data: Partial<Pick<InventoryItem, 'warehouseItemId' | 'isActive' | 'minStock' | 'parLevel' | 'reorderPoint'>>,
): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(`/inventory/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function receiveFromWarehouse(
  id: string,
  quantity: number,
): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(`/inventory/${id}/receive-from-warehouse`, {
    method: 'POST',
    body: JSON.stringify({ quantity }),
  });
}

/**
 * Resolve a scanned/typed barcode to a sellable item. Returns null on 404
 * (unknown code) so the caller can offer "create item". Server normalizes
 * the code, so client-side trimming isn't required.
 */
export async function getInventoryItemByBarcode(
  barcode: string,
): Promise<InventoryItem | null> {
  try {
    return await apiFetch<InventoryItem>(
      `/inventory/lookup?barcode=${encodeURIComponent(barcode)}`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}
