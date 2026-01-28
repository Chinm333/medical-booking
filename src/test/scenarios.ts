import { BookingRequest, Gender } from '../types';
import { initiateBooking, getBookingStatus } from '../workflow/orchestrator';
import { resetQuota, grantR1Discount } from '../storage/quotaStore';
import { clearStore } from '../storage/bookingStore';
import '../events/handlers'; 
import { v4 as uuidv4 } from 'uuid';
import { clearSlots } from '../storage/slotStore';
import { clearConfirmations } from '../storage/confirmationStore';

const POLL_INTERVAL = 500;
const MAX_POLL_ATTEMPTS = 60;

async function waitForCompletion(requestId: string): Promise<any> {
  let attempts = 0;
  
  while (attempts < MAX_POLL_ATTEMPTS) {
    const booking = getBookingStatus(requestId);
    
    if (!booking) {
      throw new Error('Booking not found');
    }
    
    if (booking.status === 'completed' || booking.status === 'failed') {
      return booking;
    }
    
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    attempts++;
  }
  
  throw new Error('Timeout waiting for booking completion');
}

function displayResult(scenarioName: string, booking: any): void {
  console.log('\n' + '='.repeat(70));
  console.log(`${scenarioName}`);
  console.log('='.repeat(70));
  
  if (booking.status === 'completed') {
    console.log('Status: SUCCESS');
    console.log(`   Reference ID: ${booking.referenceId}`);
    console.log(`   Base Price: ₹${booking.basePrice.toFixed(2)}`);
    console.log(`   R1 Discount Applied: ${booking.r1DiscountApplied ? 'Yes' : 'No'}`);
    console.log(`   R2 Discount Applied: ${booking.r2DiscountApplied ? 'Yes' : 'No'}`);
    console.log(`   Final Price: ₹${booking.finalPrice.toFixed(2)}`);
  } else {
    console.log('Status: FAILED');
    console.log(`   Error: ${booking.error || 'Unknown error'}`);
    if (booking.compensationActions.length > 0) {
      console.log(`   Compensation Actions: ${booking.compensationActions.length}`);
      booking.compensationActions.forEach((action: any) => {
        console.log(`     - ${action.action}: ${action.status}`);
      });
    }
  }
  
  console.log('='.repeat(70) + '\n');
}

async function scenario1_PositiveCase(): Promise<void> {
  console.log('\nRunning Scenario 1: Positive Case');
  console.log('   User: Female, Birthday today, High-value order (>₹1000)');
  
  clearStore();
  resetQuota();
  clearSlots();
  clearConfirmations();
  
  const today = new Date().toISOString().split('T')[0];
  const [year, month, day] = today.split('-');
  
  const request: BookingRequest = {
    requestId: uuidv4(),
    user: {
      name: 'Priya Sharma',
      gender: Gender.FEMALE,
      dateOfBirth: `${year}-${month}-${day}` 
    },
    selectedServices: ['gyn-001', 'gyn-002', 'gyn-003'], 
    timestamp: new Date().toISOString()
  };
  
  await initiateBooking(request);
  const result = await waitForCompletion(request.requestId);
  displayResult('Scenario 1: Positive Case', result);
}

async function scenario2_NegativeCase_QuotaExhausted(): Promise<void> {
  console.log('\nRunning Scenario 2: Negative Case - Quota Exhausted (compensates slot)');
  console.log('   Pre-condition: R1 discount quota exhausted; slot reservation is released in compensation');
  
  clearStore();
  resetQuota();
  clearSlots();
  clearConfirmations();
  for (let i = 0; i < 100; i++) {
    grantR1Discount();
  }
  
  const today = new Date().toISOString().split('T')[0];
  const [year, month, day] = today.split('-');
  
  const request: BookingRequest = {
    requestId: uuidv4(),
    user: {
      name: 'Raj Kumar',
      gender: Gender.MALE,
      dateOfBirth: '1990-01-15'
    },
    selectedServices: ['common-001', 'common-002', 'common-003', 'common-004'], // Total: ₹2300 (>₹1000)
    timestamp: new Date().toISOString()
  };
  
  await initiateBooking(request);
  const result = await waitForCompletion(request.requestId);
  displayResult('Scenario 2: Negative Case - Quota Exhausted (compensation expected)', result);
}

async function scenario3_NegativeCase_FailAfterPrice(): Promise<void> {
  console.log('\nRunning Scenario 3: Negative Case - Fail After Price (compensates quota + slot)');
  console.log('   Simulated failure point: after_price');
  
  clearStore();
  resetQuota();
  clearSlots();
  clearConfirmations();

  const today = new Date().toISOString().split('T')[0];
  const [year, month, day] = today.split('-');
  
  const request: BookingRequest = {
    requestId: uuidv4(),
    user: {
      name: 'Sneha Reddy',
      gender: Gender.FEMALE,
      dateOfBirth: `${year}-${month}-${day}` 
    },
    selectedServices: ['gyn-001', 'gyn-002'], 
    timestamp: new Date().toISOString(),
    simulateFailureAt: 'after_price'
  };
  
  await initiateBooking(request);
  const result = await waitForCompletion(request.requestId);
  displayResult('Scenario 3: Negative Case - Fail After Price (compensation expected)', result);
}

async function scenario4_NegativeCase_FailDuringCompletion(): Promise<void> {
  console.log('\nRunning Scenario 4: Negative Case - Fail During Completion (compensates confirmation + quota + slot)');
  console.log('   Simulated failure point: complete_booking');
  
  clearStore();
  resetQuota();
  clearSlots();
  clearConfirmations();
  
  const today = new Date().toISOString().split('T')[0];
  const [year, month, day] = today.split('-');
  
  const request: BookingRequest = {
    requestId: uuidv4(),
    user: {
      name: 'Sneha Reddy',
      gender: Gender.FEMALE,
      dateOfBirth: `${year}-${month}-${day}` 
    },
    selectedServices: ['gyn-001', 'gyn-002'], 
    timestamp: new Date().toISOString(),
    simulateFailureAt: 'complete_booking'
  };
  
  await initiateBooking(request);
  const result = await waitForCompletion(request.requestId);
  displayResult('Scenario 4: Negative Case - Fail During Completion (compensation expected)', result);
}

async function runAllScenarios(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('MEDICAL BOOKING SYSTEM - TEST SCENARIOS');
  console.log('='.repeat(70));
  
  try {
    await scenario1_PositiveCase();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await scenario2_NegativeCase_QuotaExhausted();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await scenario3_NegativeCase_FailAfterPrice();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await scenario4_NegativeCase_FailDuringCompletion();
    
    console.log('\nAll test scenarios completed.\n');
  } catch (error) {
    console.error('Error running scenarios:', error);
  }
}

if (require.main === module) {
  runAllScenarios().catch(console.error);
}
