import { create } from 'zustand';

interface OrderState {
  orders: any[];
  menuItems: any[];
  loading: boolean;
  setOrders: (orders: any[]) => void;
  setMenuItems: (items: any[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  menuItems: [],
  loading: false,
  setOrders: (orders) => set({ orders }),
  setMenuItems: (menuItems) => set({ menuItems }),
  setLoading: (loading) => set({ loading }),
}));
