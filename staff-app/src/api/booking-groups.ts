import { apiFetch } from './client';

export type BookingGroupStatus =
  | 'pending'
  | 'active'
  | 'closed'
  | 'cancelled';

export interface BookingGroup {
  id: string;
  code: string;
  name: string;
  leaderGuestId: string | null;
  leaderGuest?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  organization: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  status: BookingGroupStatus;
  discountPercent: number | null;
  notes: string | null;
  routeAllToMaster: boolean;
  masterFolioId: string | null;
  masterFolio?: {
    id: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
  };
  reservations?: Array<{
    id: string;
    roomNumber: number;
    checkInDate: string;
    checkOutDate: string;
    numberOfGuests: number;
    status: string;
    totalPrice: number;
    guest?: { firstName: string; lastName: string } | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingGroupData {
  name: string;
  code?: string;
  leaderGuestId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  organization?: string;
  checkInDate?: string;
  checkOutDate?: string;
  discountPercent?: number;
  notes?: string;
  routeAllToMaster?: boolean;
}

export type UpdateBookingGroupData = Partial<
  Omit<CreateBookingGroupData, 'code'>
> & {
  status?: BookingGroupStatus;
};

export interface AddRoomToGroupData {
  roomNumber: number;
  guestId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  numberOfGuests?: number;
  notes?: string;
}

export function getBookingGroups(
  status?: BookingGroupStatus,
): Promise<BookingGroup[]> {
  const q = status ? `?status=${status}` : '';
  return apiFetch<BookingGroup[]>(`/booking-groups${q}`);
}

export function getBookingGroup(id: string): Promise<BookingGroup> {
  return apiFetch<BookingGroup>(`/booking-groups/${id}`);
}

export interface BookingGroupStatement {
  group: {
    id: string;
    code: string;
    name: string;
    organization: string | null;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    leaderGuest: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      email?: string | null;
    } | null;
    checkInDate: string | null;
    checkOutDate: string | null;
    status: BookingGroupStatus;
    discountPercent: number | null;
    notes: string | null;
    routeAllToMaster: boolean;
    createdAt: string;
  };
  reservations: Array<{
    id: string;
    reservationNumber?: number;
    roomNumber: number;
    checkInDate: string;
    checkOutDate: string;
    numberOfGuests: number;
    status: string;
    totalPrice: number;
    guest: { firstName?: string; lastName?: string } | null;
  }>;
  folio: {
    id: string;
    totalAmount: number;
    paidAmount: number;
    balance: number;
    openedAt: string | null;
    closedAt: string | null;
    charges: Array<{
      id: string;
      chargeType: string;
      description: string;
      amount: number;
      createdAt: string;
    }>;
    byType: Record<string, number>;
  } | null;
  issuedAt: string;
}

export function getBookingGroupStatement(
  id: string,
): Promise<BookingGroupStatement> {
  return apiFetch<BookingGroupStatement>(`/booking-groups/${id}/statement`);
}

export function createBookingGroup(
  data: CreateBookingGroupData,
): Promise<BookingGroup> {
  return apiFetch<BookingGroup>('/booking-groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateBookingGroup(
  id: string,
  data: UpdateBookingGroupData,
): Promise<BookingGroup> {
  return apiFetch<BookingGroup>(`/booking-groups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function addRoomToGroup(
  id: string,
  data: AddRoomToGroupData,
): Promise<any> {
  return apiFetch(`/booking-groups/${id}/rooms`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function removeRoomFromGroup(
  id: string,
  reservationId: string,
): Promise<void> {
  return apiFetch<void>(
    `/booking-groups/${id}/rooms/${reservationId}`,
    { method: 'DELETE' },
  );
}

export type GroupChargeType =
  | 'restaurant'
  | 'bar'
  | 'shop'
  | 'rental'
  | 'service'
  | 'discount';

export function addGroupCharge(
  id: string,
  data: {
    description: string;
    amount: number;
    chargeType?: GroupChargeType;
  },
): Promise<any> {
  return apiFetch(`/booking-groups/${id}/charges`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function addGroupPayment(
  id: string,
  data: { amount: number; description?: string },
): Promise<any> {
  return apiFetch(`/booking-groups/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function closeBookingGroup(id: string): Promise<BookingGroup> {
  return apiFetch<BookingGroup>(`/booking-groups/${id}/close`, {
    method: 'POST',
  });
}

export function cancelBookingGroup(
  id: string,
  options: { cascade?: boolean } = {},
): Promise<BookingGroup> {
  return apiFetch<BookingGroup>(`/booking-groups/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}
