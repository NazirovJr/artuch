import { apiFetch } from './client';

export interface RoomType {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  maxGuests: number;
  maxAdults: number;
  maxChildren: number;
  beds: number;
  bedConfiguration: string | null;
  sizeM2: number | null;
  view: string | null;
  basePrice: number;
  weekendPrice: number | null;
  taxRate: number | null;
  taxIncluded: boolean;
  photos: string[];
  coverPhoto: string | null;
  videoUrl: string | null;
  amenities: string[];
  smokingAllowed: boolean;
  petsAllowed: boolean;
  accessibleForDisabled: boolean;
  childrenAllowed: boolean;
  breakfastIncluded: boolean;
  minStayNights: number;
  maxStayNights: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomTypeData {
  code: string;
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  maxGuests?: number;
  maxAdults?: number;
  maxChildren?: number;
  beds?: number;
  bedConfiguration?: string;
  sizeM2?: number;
  view?: string;
  basePrice: number;
  weekendPrice?: number;
  taxRate?: number;
  taxIncluded?: boolean;
  photos?: string[];
  coverPhoto?: string;
  videoUrl?: string;
  amenities?: string[];
  smokingAllowed?: boolean;
  petsAllowed?: boolean;
  accessibleForDisabled?: boolean;
  childrenAllowed?: boolean;
  breakfastIncluded?: boolean;
  minStayNights?: number;
  maxStayNights?: number;
  displayOrder?: number;
}

export type UpdateRoomTypeData = Partial<Omit<CreateRoomTypeData, 'code'>> & {
  isActive?: boolean;
};

export type RoomTypeStats = Record<
  string,
  { active: number; inactive: number }
>;

export function getRoomTypes(includeInactive = false): Promise<RoomType[]> {
  const q = includeInactive ? '?includeInactive=true' : '';
  return apiFetch<RoomType[]>(`/room-types${q}`);
}

export function getRoomTypeStats(): Promise<RoomTypeStats> {
  return apiFetch<RoomTypeStats>('/room-types/stats');
}

export function getRoomType(id: string): Promise<RoomType> {
  return apiFetch<RoomType>(`/room-types/${id}`);
}

export function createRoomType(data: CreateRoomTypeData): Promise<RoomType> {
  return apiFetch<RoomType>('/room-types', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateRoomType(
  id: string,
  data: UpdateRoomTypeData,
): Promise<RoomType> {
  return apiFetch<RoomType>(`/room-types/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteRoomType(id: string): Promise<void> {
  return apiFetch<void>(`/room-types/${id}`, { method: 'DELETE' });
}

// ─── Rooms (extended) ─────────────────────────────────────────

export interface Room {
  number: number;
  type: string;
  roomTypeId: string | null;
  roomType?: RoomType;
  beds: number;
  maxGuests: number;
  pricePerNight: number;
  floor: number | null;
  location: string | null;
  notes: string | null;
  status: string;
  cleaningStatus: string;
  currentReservationId: string | null;
  isActive: boolean;
}

export interface CreateRoomData {
  number: number;
  roomTypeId?: string;
  type?: string;
  beds?: number;
  maxGuests?: number;
  pricePerNight?: number;
  floor?: number;
  location?: string;
  notes?: string;
}

export interface BulkCreateRoomsData {
  roomTypeId: string;
  numbers?: number[];
  from?: number;
  count?: number;
  floor?: number;
}

export function createRoom(data: CreateRoomData): Promise<Room> {
  return apiFetch<Room>('/v2/rooms', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function bulkCreateRooms(
  data: BulkCreateRoomsData,
): Promise<{ created: Room[]; skipped: number[] }> {
  return apiFetch('/v2/rooms/bulk', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteRoom(number: number): Promise<void> {
  return apiFetch<void>(`/v2/rooms/${number}`, { method: 'DELETE' });
}

export function updateRoomDetails(
  number: number,
  data: Partial<CreateRoomData> & { isActive?: boolean; status?: string },
): Promise<Room> {
  return apiFetch<Room>(`/v2/rooms/${number}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
