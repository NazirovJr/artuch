import { create } from 'zustand';
import type { Outlet } from '../api/outlets';

export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'folio';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  volume?: number;
}

interface PosState {
  cart: CartItem[];
  currentOutlet: Outlet | null;
  paymentMethod: PaymentMethod;
  /**
   * When paymentMethod='folio', this points at the open folio that should
   * receive the bill. Cleared automatically on every clearCart() so the
   * next cashier doesn't accidentally post to the previous guest.
   */
  selectedFolioId: string | null;
  /** Optional display metadata for the picked folio (room number, guest
   * name, current balance) — rendered on the "Bill to room #N" button. */
  selectedFolioMeta: { roomNumber?: number; guestName?: string; balance?: number } | null;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setOutlet: (outlet: any) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setSelectedFolio: (
    folioId: string | null,
    meta?: { roomNumber?: number; guestName?: string; balance?: number } | null,
  ) => void;
  getTotal: () => number;
}

export const usePosStore = create<PosState>((set, get) => ({
  cart: [],
  currentOutlet: null,
  paymentMethod: 'cash',
  selectedFolioId: null,
  selectedFolioMeta: null,
  addToCart: (item) => {
    const cart = get().cart;
    const existing = cart.find((i) => i.id === item.id);
    if (existing) {
      set({ cart: cart.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i) });
    } else {
      set({ cart: [...cart, { ...item, quantity: 1 }] });
    }
  },
  removeFromCart: (id) => set({ cart: get().cart.filter((i) => i.id !== id) }),
  updateQuantity: (id, quantity) => {
    if (quantity <= 0) { set({ cart: get().cart.filter((i) => i.id !== id) }); return; }
    set({ cart: get().cart.map((i) => i.id === id ? { ...i, quantity } : i) });
  },
  clearCart: () =>
    // Reset the selected folio along with the cart — treating them as a
    // single "checkout session" keeps the next sale from leaking into the
    // previous guest's room bill.
    set({ cart: [], selectedFolioId: null, selectedFolioMeta: null }),
  setOutlet: (outlet) => set({ currentOutlet: outlet }),
  setPaymentMethod: (paymentMethod) => {
    // Switching away from 'folio' should drop the pending selection so the
    // cashier isn't silently still targeting a room after clicking "cash".
    if (paymentMethod !== 'folio') {
      set({ paymentMethod, selectedFolioId: null, selectedFolioMeta: null });
    } else {
      set({ paymentMethod });
    }
  },
  setSelectedFolio: (folioId, meta = null) =>
    set({ selectedFolioId: folioId, selectedFolioMeta: meta }),
  getTotal: () => get().cart.reduce((sum, i) => sum + i.price * i.quantity, 0),
}));
