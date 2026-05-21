import { create } from 'zustand';

interface RentalState {
  rentals: any[];
  loading: boolean;
  setRentals: (rentals: any[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useRentalStore = create<RentalState>((set) => ({
  rentals: [],
  loading: false,
  setRentals: (rentals) => set({ rentals }),
  setLoading: (loading) => set({ loading }),
}));
