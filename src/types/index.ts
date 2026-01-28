export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

export enum BookingStatus {
  PENDING = 'pending',
  VALIDATING = 'validating',
  CHECKING_QUOTA = 'checking_quota',
  FETCHING_HOLIDAY = 'fetching_holiday',
  CALCULATING_PRICE = 'calculating_price',
  RESERVING_SLOT = 'reserving_slot',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating'
}

export enum EventType {
  BOOKING_INITIATED = 'booking_initiated',
  USER_VALIDATED = 'user_validated',
  QUOTA_CHECKED = 'quota_checked',
  HOLIDAY_FETCHED = 'holiday_fetched',
  PRICE_CALCULATED = 'price_calculated',
  SLOT_RESERVED = 'slot_reserved',
  BOOKING_COMPLETED = 'booking_completed',
  BOOKING_FAILED = 'booking_failed',
  COMPENSATION_REQUIRED = 'compensation_required',
  COMPENSATION_COMPLETED = 'compensation_completed'
}

export interface User {
  name: string;
  gender: Gender;
  dateOfBirth: string; 
}

export interface MedicalService {
  id: string;
  name: string;
  basePrice: number;
  availableFor: Gender[]; 
}

export interface BookingRequest {
  requestId: string;
  user: User;
  selectedServices: string[]; 
  timestamp: string;
  simulateFailureAt?: 'after_price' | 'reserve_slot' | 'complete_booking';
}

export interface BookingEvent {
  eventId: string;
  eventType: EventType;
  requestId: string;
  timestamp: string;
  payload: any;
  correlationId: string;
}

export interface BookingState {
  requestId: string;
  user: User;
  selectedServices: MedicalService[];
  basePrice: number;
  r1DiscountApplied: boolean;
  r2DiscountApplied: boolean;
  finalPrice: number;
  status: BookingStatus;
  simulateFailureAt?: BookingRequest['simulateFailureAt'];
  referenceId?: string;
  error?: string;
  compensationActions: CompensationAction[];
  createdAt: string;
  updatedAt: string;
}

export interface CompensationAction {
  action: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  error?: string;
}

export interface HolidayResponse {
  isHoliday: boolean;
  holidayName?: string;
  error?: string;
}

export interface QuotaState {
  date: string;
  r1DiscountsGranted: number;
  maxR1Discounts: number;
}
