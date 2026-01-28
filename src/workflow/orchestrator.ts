import { BookingRequest, BookingState, BookingStatus } from '../types';
import { saveBookingState, getBookingState } from '../storage/bookingStore';
import { eventBus } from '../events/eventBus';
import { EventType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { createRequestLogger } from '../utils/logger';
import '../events/handlers';

export async function initiateBooking(request: BookingRequest): Promise<BookingState> {
  const correlationId = uuidv4();
  const logger = createRequestLogger(request.requestId, correlationId);
  
  logger.info('Initiating booking workflow', { request });
  const initialState: BookingState = {
    requestId: request.requestId,
    user: request.user,
    selectedServices: [],
    basePrice: 0,
    r1DiscountApplied: false,
    r2DiscountApplied: false,
    finalPrice: 0,
    status: BookingStatus.PENDING,
    simulateFailureAt: request.simulateFailureAt,
    compensationActions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  saveBookingState(initialState);
  await eventBus.publish({
    eventId: uuidv4(),
    eventType: EventType.BOOKING_INITIATED,
    requestId: request.requestId,
    timestamp: new Date().toISOString(),
    correlationId,
    payload: {
      user: request.user,
      selectedServices: request.selectedServices,
      simulateFailureAt: request.simulateFailureAt
    }
  });
  
  return initialState;
}

export function getBookingStatus(requestId: string): BookingState | undefined {
  return getBookingState(requestId);
}
