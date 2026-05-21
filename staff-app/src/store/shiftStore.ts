import { create } from 'zustand';
import {
  Shift,
  closeShift as apiCloseShift,
  getActiveShift as apiGetActiveShift,
  openShift as apiOpenShift,
} from '../api/shifts';

interface ShiftState {
  active: Shift | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  open: (data: { openingCash?: number; outletId?: string }) => Promise<Shift>;
  close: (
    id: string,
    data: { actualCash: number; managerPin?: string; notes?: string },
  ) => Promise<Shift>;
  reset: () => void;
}

export const useShiftStore = create<ShiftState>((set) => ({
  active: null,
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const shift = await apiGetActiveShift();
      set({ active: shift ?? null, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'Failed to load shift' });
    }
  },
  open: async (data) => {
    set({ loading: true, error: null });
    try {
      const shift = await apiOpenShift(data);
      set({ active: shift, loading: false });
      return shift;
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'Failed to open shift' });
      throw e;
    }
  },
  close: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const shift = await apiCloseShift(id, data);
      set({ active: null, loading: false });
      return shift;
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'Failed to close shift' });
      throw e;
    }
  },
  reset: () => set({ active: null, loading: false, error: null }),
}));
