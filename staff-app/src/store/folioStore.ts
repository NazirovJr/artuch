import { create } from 'zustand';
import * as folioApi from '../api/folios';

interface FolioState {
  folios: any[];
  currentFolio: any | null;
  loading: boolean;
  fetchFolios: (status?: string) => Promise<void>;
  fetchFolio: (id: string) => Promise<void>;
  createFolio: (data: { guestId?: string; reservationId?: string; roomNumber?: number; notes?: string }) => Promise<any>;
  addCharge: (folioId: string, data: { chargeType: string; description: string; amount: number; sourceId?: string }) => Promise<void>;
  addPayment: (folioId: string, data: { amount: number; description?: string }) => Promise<void>;
  addDiscount: (folioId: string, data: { amount: number; description: string }) => Promise<void>;
  closeFolio: (folioId: string) => Promise<void>;
  clearCurrent: () => void;
}

export const useFolioStore = create<FolioState>((set, get) => ({
  folios: [],
  currentFolio: null,
  loading: false,

  fetchFolios: async (status?: string) => {
    set({ loading: true });
    try {
      const folios = await folioApi.getFolios(status);
      set({ folios });
    } catch {
      // handle silently
    } finally {
      set({ loading: false });
    }
  },

  fetchFolio: async (id: string) => {
    set({ loading: true });
    try {
      const folio = await folioApi.getFolio(id);
      set({ currentFolio: folio });
    } catch {
      // handle silently
    } finally {
      set({ loading: false });
    }
  },

  createFolio: async (data) => {
    const folio = await folioApi.createFolio(data);
    set({ folios: [folio, ...get().folios] });
    return folio;
  },

  addCharge: async (folioId, data) => {
    await folioApi.addCharge(folioId, data);
    await get().fetchFolio(folioId);
  },

  addPayment: async (folioId, data) => {
    await folioApi.addPayment(folioId, data);
    await get().fetchFolio(folioId);
  },

  addDiscount: async (folioId, data) => {
    await folioApi.addDiscount(folioId, data);
    await get().fetchFolio(folioId);
  },

  closeFolio: async (folioId) => {
    await folioApi.closeFolio(folioId);
    await get().fetchFolio(folioId);
  },

  clearCurrent: () => set({ currentFolio: null }),
}));
