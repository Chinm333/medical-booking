import { QuotaState } from '../types';
import { getISTDate } from '../utils/date';
import { getISTMidnightTimestamp } from '../utils/date';

const quotaStore: Map<string, QuotaState> = new Map();

const MAX_R1_DISCOUNTS = parseInt(process.env.MAX_R1_DISCOUNTS || '100', 10);

export function getQuotaState(date?: string): QuotaState {
  const targetDate = date || getISTDate();
  
  let quota = quotaStore.get(targetDate);
  
  if (!quota) {
    quota = {
      date: targetDate,
      r1DiscountsGranted: 0,
      maxR1Discounts: MAX_R1_DISCOUNTS
    };
    quotaStore.set(targetDate, quota);
  }
  
  const now = Date.now();
  const midnightIST = getISTMidnightTimestamp();
  const lastMidnight = midnightIST;
  
  if (quota.date !== targetDate) {
    quota = {
      date: targetDate,
      r1DiscountsGranted: 0,
      maxR1Discounts: MAX_R1_DISCOUNTS
    };
    quotaStore.set(targetDate, quota);
  }
  
  return quota;
}

export function canGrantR1Discount(date?: string): boolean {
  const quota = getQuotaState(date);
  return quota.r1DiscountsGranted < quota.maxR1Discounts;
}

export function grantR1Discount(date?: string): boolean {
  const quota = getQuotaState(date);
  
  if (quota.r1DiscountsGranted >= quota.maxR1Discounts) {
    return false;
  }
  
  quota.r1DiscountsGranted++;
  quotaStore.set(quota.date, quota);
  return true;
}

export function revokeR1Discount(date?: string): void {
  const quota = getQuotaState(date);
  
  if (quota.r1DiscountsGranted > 0) {
    quota.r1DiscountsGranted--;
    quotaStore.set(quota.date, quota);
  }
}

export function getQuotaStatus(date?: string): { granted: number; max: number; remaining: number } {
  const quota = getQuotaState(date);
  return {
    granted: quota.r1DiscountsGranted,
    max: quota.maxR1Discounts,
    remaining: quota.maxR1Discounts - quota.r1DiscountsGranted
  };
}

export function resetQuota(date?: string): void {
  const targetDate = date || getISTDate();
  quotaStore.delete(targetDate);
}
