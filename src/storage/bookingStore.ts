import { BookingState, BookingStatus } from '../types';

const bookingStore: Map<string, BookingState> = new Map();

export function saveBookingState(state: BookingState): void {
  bookingStore.set(state.requestId, state);
}

export function getBookingState(requestId: string): BookingState | undefined {
  return bookingStore.get(requestId);
}

export function updateBookingStatus(
  requestId: string, 
  status: BookingStatus,
  updates?: Partial<BookingState>
): BookingState | undefined {
  const state = getBookingState(requestId);
  if (!state) {
    return undefined;
  }
  
  const updated: BookingState = {
    ...state,
    ...updates,
    status,
    updatedAt: new Date().toISOString()
  };
  
  saveBookingState(updated);
  return updated;
}

export function getAllBookings(): BookingState[] {
  return Array.from(bookingStore.values());
}

export function clearStore(): void {
  bookingStore.clear();
}
