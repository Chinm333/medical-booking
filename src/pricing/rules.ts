import { User, MedicalService, Gender } from '../types';
import { isTodayBirthday } from '../utils/date';
import { checkIfHoliday } from '../services/holidayService';
import { canGrantR1Discount, grantR1Discount, revokeR1Discount } from '../storage/quotaStore';
import { createRequestLogger } from '../utils/logger';

export interface PricingResult {
  basePrice: number;
  r1DiscountApplied: boolean;
  r1DiscountAmount: number;
  r2DiscountApplied: boolean;
  r2DiscountAmount: number;
  finalPrice: number;
  r1QuotaExhausted: boolean;
  holidayCheckError?: string;
}

export async function calculatePrice(
  user: User,
  services: MedicalService[],
  requestId: string,
  correlationId: string
): Promise<PricingResult> {
  const logger = createRequestLogger(requestId, correlationId);
  
  const basePrice = services.reduce((sum, service) => sum + service.basePrice, 0);
  
  logger.info('Calculating price', { basePrice, serviceCount: services.length });
  const isFemale = user.gender === Gender.FEMALE;
  const isBirthday = isTodayBirthday(user.dateOfBirth);
  const isHighValue = basePrice > 1000;
  const qualifiesForR1 = (isFemale && isBirthday) || isHighValue;
  let r1DiscountApplied = false;
  let r1DiscountAmount = 0;
  let r1QuotaExhausted = false;
  
  if (qualifiesForR1) {
    logger.info('Request qualifies for R1 discount', { 
      isFemale, 
      isBirthday, 
      isHighValue 
    });
    
    if (canGrantR1Discount()) {
      if (grantR1Discount()) {
        r1DiscountApplied = true;
        r1DiscountAmount = basePrice * 0.12;
        logger.info('R1 discount granted', { r1DiscountAmount });
      } else {
        r1QuotaExhausted = true;
        logger.warn('R1 discount quota exhausted');
      }
    } else {
      r1QuotaExhausted = true;
      logger.warn('R1 discount quota exhausted');
    }
  }
  
  let r2DiscountApplied = false;
  let r2DiscountAmount = 0;
  let holidayCheckError: string | undefined;
  
  try {
    const holidayCheck = await checkIfHoliday();
    
    if (holidayCheck.isHoliday) {
      r2DiscountApplied = true;
      const priceAfterR1 = basePrice - r1DiscountAmount;
      r2DiscountAmount = priceAfterR1 * 0.03;
      logger.info('R2 holiday discount applied', { 
        holidayName: holidayCheck.holidayName,
        r2DiscountAmount 
      });
    }
    
    if (holidayCheck.error) {
      holidayCheckError = holidayCheck.error;
      logger.warn('Holiday check completed with warning', { error: holidayCheck.error });
    }
  } catch (error) {
    holidayCheckError = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to check holiday', error);
  }
  
  const finalPrice = basePrice - r1DiscountAmount - r2DiscountAmount;
  logger.info('Price calculation completed', {
    basePrice,
    r1DiscountApplied,
    r1DiscountAmount,
    r2DiscountApplied,
    r2DiscountAmount,
    finalPrice
  });
  
  return {
    basePrice,
    r1DiscountApplied,
    r1DiscountAmount,
    r2DiscountApplied,
    r2DiscountAmount,
    finalPrice,
    r1QuotaExhausted,
    holidayCheckError
  };
}

export function compensateR1Discount(requestId: string, correlationId: string): void {
  const logger = createRequestLogger(requestId, correlationId);
  logger.info('Compensating R1 discount - revoking quota');
  revokeR1Discount();
}
