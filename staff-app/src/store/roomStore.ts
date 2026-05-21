import { create } from 'zustand';

interface RoomState {
  rooms: any[];
  reservations: any[];
  guests: any[];
  loading: boolean;
  setRooms: (rooms: any[]) => void;
  setReservations: (reservations: any[]) => void;
  setGuests: (guests: any[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  rooms: [],
  reservations: [],
  guests: [],
  loading: false,
  setRooms: (rooms) => set({ rooms }),
  setReservations: (reservations) => set({ reservations }),
  setGuests: (guests) => set({ guests }),
  setLoading: (loading) => set({ loading }),
}));
