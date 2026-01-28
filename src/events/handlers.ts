import { EventType, BookingStatus, CompensationAction, MedicalService } from '../types';
import { updateBookingStatus, getBookingState } from '../storage/bookingStore';
import { calculatePrice, compensateR1Discount } from '../pricing/rules';
import { getServiceById } from '../data/services';
import { createRequestLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from './eventBus';
import { reserveSlot, isSlotReserved, releaseSlot } from '../storage/slotStore';
import { createConfirmation, hasConfirmation, deleteConfirmation } from '../storage/confirmationStore';

eventBus.subscribe(EventType.BOOKING_INITIATED, async (event) => {
  const logger = createRequestLogger(event.requestId, event.correlationId);
  logger.info('Processing booking initiation', { payload: event.payload });

  const { user, selectedServices, simulateFailureAt } = event.payload;
  if (!user.name || !user.gender || !user.dateOfBirth) {
    await eventBus.publish({
      eventId: uuidv4(),
      eventType: EventType.BOOKING_FAILED,
      requestId: event.requestId,
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: { error: 'Invalid user data: missing required fields' }
    });
    return;
  }
  const services = selectedServices
    .map((id: string) => getServiceById(id))
    .filter((service: MedicalService | undefined): service is MedicalService => service !== undefined);

  if (services.length === 0) {
    await eventBus.publish({
      eventId: uuidv4(),
      eventType: EventType.BOOKING_FAILED,
      requestId: event.requestId,
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: { error: 'No valid services selected' }
    });
    return;
  }
  const invalidServices = services.filter(
    (service: MedicalService) => !service.availableFor.includes(user.gender)
  );

  if (invalidServices.length > 0) {
    await eventBus.publish({
      eventId: uuidv4(),
      eventType: EventType.BOOKING_FAILED,
      requestId: event.requestId,
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: {
        error: `Services not available for ${user.gender}: ${invalidServices.map((s: MedicalService) => s.name).join(', ')}`
      }
    });
    return;
  }

  updateBookingStatus(event.requestId, BookingStatus.VALIDATING, {
    user,
    selectedServices: services,
    simulateFailureAt
  });

  await eventBus.publish({
    eventId: uuidv4(),
    eventType: EventType.USER_VALIDATED,
    requestId: event.requestId,
    timestamp: new Date().toISOString(),
    correlationId: event.correlationId,
    payload: { user, services }
  });
});

eventBus.subscribe(EventType.USER_VALIDATED, async (event) => {
  const logger = createRequestLogger(event.requestId, event.correlationId);
  logger.info('User validated, reserving slot', { payload: event.payload });

  const state = getBookingState(event.requestId);
  if (!state) {
    logger.error('Booking state not found');
    return;
  }

  updateBookingStatus(event.requestId, BookingStatus.RESERVING_SLOT);
  const reservation = reserveSlot(event.requestId);
  logger.info('Slot reserved', reservation);

  if (state.simulateFailureAt === 'reserve_slot') {
    await eventBus.publish({
      eventId: uuidv4(),
      eventType: EventType.COMPENSATION_REQUIRED,
      requestId: event.requestId,
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: { error: 'Simulated failure at reserve_slot' }
    });
    return;
  }

  await eventBus.publish({
    eventId: uuidv4(),
    eventType: EventType.SLOT_RESERVED,
    requestId: event.requestId,
    timestamp: new Date().toISOString(),
    correlationId: event.correlationId,
    payload: { reservation }
  });
});

eventBus.subscribe(EventType.SLOT_RESERVED, async (event) => {
  const logger = createRequestLogger(event.requestId, event.correlationId);
  logger.info('Slot reserved, calculating price');

  const state = getBookingState(event.requestId);
  if (!state || !state.user || !state.selectedServices) {
    logger.error('Invalid state for price calculation');
    await eventBus.publish({
      eventId: uuidv4(),
      eventType: EventType.BOOKING_FAILED,
      requestId: event.requestId,
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: { error: 'Invalid state for price calculation' }
    });
    return;
  }

  updateBookingStatus(event.requestId, BookingStatus.CALCULATING_PRICE);

  try {
    const pricingResult = await calculatePrice(
      state.user,
      state.selectedServices,
      event.requestId,
      event.correlationId
    );

    if (pricingResult.r1QuotaExhausted) {
      await eventBus.publish({
        eventId: uuidv4(),
        eventType: EventType.COMPENSATION_REQUIRED,
        requestId: event.requestId,
        timestamp: new Date().toISOString(),
        correlationId: event.correlationId,
        payload: {
          error: 'Daily discount quota reached. Please try again tomorrow.',
          pricingResult
        }
      });
      return;
    }

    updateBookingStatus(event.requestId, BookingStatus.PROCESSING, {
      basePrice: pricingResult.basePrice,
      r1DiscountApplied: pricingResult.r1DiscountApplied,
      r2DiscountApplied: pricingResult.r2DiscountApplied,
      finalPrice: pricingResult.finalPrice
    });

    if (state.simulateFailureAt === 'after_price') {
      await eventBus.publish({
        eventId: uuidv4(),
        eventType: EventType.COMPENSATION_REQUIRED,
        requestId: event.requestId,
        timestamp: new Date().toISOString(),
        correlationId: event.correlationId,
        payload: { error: 'Simulated failure at after_price', pricingResult }
      });
      return;
    }

    await eventBus.publish({
      eventId: uuidv4(),
      eventType: EventType.PRICE_CALCULATED,
      requestId: event.requestId,
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: { pricingResult }
    });
  } catch (error) {
    logger.error('Price calculation failed', error);
    await eventBus.publish({
      eventId: uuidv4(),
      eventType: EventType.COMPENSATION_REQUIRED,
      requestId: event.requestId,
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: { error: 'Price calculation failed', originalError: error }
    });
  }
});

eventBus.subscribe(EventType.PRICE_CALCULATED, async (event) => {
  const logger = createRequestLogger(event.requestId, event.correlationId);
  logger.info('Price calculated, completing booking');

  const state = getBookingState(event.requestId);
  if (!state) {
    logger.error('Booking state not found');
    return;
  }

  const referenceId = `MB-${event.requestId.substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  createConfirmation(event.requestId, referenceId);
  updateBookingStatus(event.requestId, BookingStatus.PROCESSING, { referenceId });

  if (state.simulateFailureAt === 'complete_booking') {
    await eventBus.publish({
      eventId: uuidv4(),
      eventType: EventType.COMPENSATION_REQUIRED,
      requestId: event.requestId,
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: { error: 'Simulated failure at complete_booking', referenceId }
    });
    return;
  }

  updateBookingStatus(event.requestId, BookingStatus.COMPLETED, { referenceId });

  await eventBus.publish({
    eventId: uuidv4(),
    eventType: EventType.BOOKING_COMPLETED,
    requestId: event.requestId,
    timestamp: new Date().toISOString(),
    correlationId: event.correlationId,
    payload: { referenceId, finalPrice: state.finalPrice }
  });
});

eventBus.subscribe(EventType.COMPENSATION_REQUIRED, async (event) => {
  const logger = createRequestLogger(event.requestId, event.correlationId);
  logger.info('Compensation required, starting compensation process');

  const state = getBookingState(event.requestId);
  if (!state) {
    logger.error('Booking state not found for compensation');
    return;
  }

  updateBookingStatus(event.requestId, BookingStatus.COMPENSATING);

  const compensationActions: CompensationAction[] = [];

  if (hasConfirmation(event.requestId)) {
    try {
      deleteConfirmation(event.requestId);
      compensationActions.push({
        action: 'delete_booking_confirmation',
        status: 'completed',
        timestamp: new Date().toISOString()
      });
      logger.info('Booking confirmation deleted');
    } catch (error) {
      logger.error('Failed to delete booking confirmation', error);
      compensationActions.push({
        action: 'delete_booking_confirmation',
        status: 'failed',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  if (isSlotReserved(event.requestId)) {
    try {
      releaseSlot(event.requestId);
      compensationActions.push({
        action: 'release_reserved_slot',
        status: 'completed',
        timestamp: new Date().toISOString()
      });
      logger.info('Reserved slot released');
    } catch (error) {
      logger.error('Failed to release reserved slot', error);
      compensationActions.push({
        action: 'release_reserved_slot',
        status: 'failed',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  if (state.r1DiscountApplied) {
    try {
      compensateR1Discount(event.requestId, event.correlationId);
      compensationActions.push({
        action: 'revoke_r1_discount_quota',
        status: 'completed',
        timestamp: new Date().toISOString()
      });
      logger.info('R1 discount quota revoked');
    } catch (error) {
      logger.error('Failed to revoke R1 discount', error);
      compensationActions.push({
        action: 'revoke_r1_discount_quota',
        status: 'failed',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  updateBookingStatus(event.requestId, BookingStatus.FAILED, {
    error: event.payload.error || 'Booking failed',
    compensationActions,
    referenceId: undefined
  });

  await eventBus.publish({
    eventId: uuidv4(),
    eventType: EventType.COMPENSATION_COMPLETED,
    requestId: event.requestId,
    timestamp: new Date().toISOString(),
    correlationId: event.correlationId,
    payload: { compensationActions }
  });
});

eventBus.subscribe(EventType.BOOKING_FAILED, async (event) => {
  const logger = createRequestLogger(event.requestId, event.correlationId);
  logger.info('Booking failed', { error: event.payload.error });

  const state = getBookingState(event.requestId);

  if (state && (state.r1DiscountApplied || isSlotReserved(event.requestId) || hasConfirmation(event.requestId) || !!state.referenceId)) {
    await eventBus.publish({
      eventId: uuidv4(),
      eventType: EventType.COMPENSATION_REQUIRED,
      requestId: event.requestId,
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: { error: event.payload.error }
    });
    return;
  }

  updateBookingStatus(event.requestId, BookingStatus.FAILED, {
    error: event.payload.error || 'Booking failed'
  });
});
