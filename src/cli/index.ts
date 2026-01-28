import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { BookingRequest, Gender, MedicalService } from '../types';
import { getServicesForGender } from '../data/services';
import { initiateBooking, getBookingStatus } from '../workflow/orchestrator';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

function displayServices(services: MedicalService[]): void {
  console.log('\nAvailable Medical Services:\n');
  services.forEach((service, index) => {
    console.log(`  ${index + 1}. ${service.name.padEnd(40)} ₹${service.basePrice}`);
  });
  console.log('');
}

function displayStatus(status: string, details?: any): void {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${status}`);
  if (details) {
    console.log(`   Details:`, details);
  }
}

function displaySuccess(booking: any): void {
  console.log('\n' + '='.repeat(60));
  console.log('BOOKING CONFIRMED');
  console.log('='.repeat(60));
  console.log(`\nReference ID: ${booking.referenceId}`);
  console.log(`Final Price: ₹${booking.finalPrice.toFixed(2)}`);
  console.log(`\nBase Price: ₹${booking.basePrice.toFixed(2)}`);
  if (booking.r1DiscountApplied) {
    console.log(`R1 Discount (12%): Applied`);
  }
  if (booking.r2DiscountApplied) {
    console.log(`R2 Discount (3% Holiday): Applied`);
  }
  console.log('\n' + '='.repeat(60) + '\n');
}

function displayFailure(error: string): void {
  console.log('\n' + '='.repeat(60));
  console.log('BOOKING FAILED');
  console.log('='.repeat(60));
  console.log(`\nError: ${error}\n`);
  console.log('='.repeat(60) + '\n');
}

async function pollBookingStatus(requestId: string, maxAttempts: number = 60): Promise<void> {
  let attempts = 0;
  const pollInterval = 500;
  
  while (attempts < maxAttempts) {
    const booking = getBookingStatus(requestId);
    
    if (!booking) {
      displayFailure('Booking not found');
      return;
    }
    
    switch (booking.status) {
      case 'validating':
        displayStatus('Validating user information...');
        break;
      case 'reserving_slot':
        displayStatus('Reserving appointment slot...');
        break;
      case 'calculating_price':
        displayStatus('Calculating final price...');
        break;
      case 'processing':
        displayStatus('Processing booking...');
        break;
      case 'compensating':
        displayStatus('Compensating transaction...', { 
          actions: booking.compensationActions.length 
        });
        break;
      case 'completed':
        displaySuccess(booking);
        return;
      case 'failed':
        displayFailure(booking.error || 'Unknown error');
        return;
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    attempts++;
  }
  
  displayFailure('Request timeout - booking processing took too long');
}

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('Medical Clinic Booking System');
  console.log('='.repeat(60) + '\n');
  
  try {
    const name = await question('Enter your name: ');
    if (!name.trim()) {
      console.log('Name is required');
      rl.close();
      return;
    }
    
    console.log('\nGender options:');
    console.log('1. Male');
    console.log('2. Female');
    console.log('3. Other');
    const genderChoice = await question('\nSelect gender (1-3): ');
    
    let gender: Gender;
    switch (genderChoice.trim()) {
      case '1':
        gender = Gender.MALE;
        break;
      case '2':
        gender = Gender.FEMALE;
        break;
      case '3':
        gender = Gender.OTHER;
        break;
      default:
        console.log('Invalid gender selection');
        rl.close();
        return;
    }
    
    const dob = await question('Enter date of birth (YYYY-MM-DD): ');
    if (!dob.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      console.log('Invalid date format. Please use YYYY-MM-DD');
      rl.close();
      return;
    }
    
    const services = getServicesForGender(gender);
    displayServices(services);
    const serviceInput = await question('Select services (comma-separated numbers, e.g., 1,3,5): ');
    const selectedIndices = serviceInput
      .split(',')
      .map(s => parseInt(s.trim()) - 1)
      .filter(idx => idx >= 0 && idx < services.length);
    
    if (selectedIndices.length === 0) {
      console.log('No valid services selected');
      rl.close();
      return;
    }
    
    const selectedServices = selectedIndices.map(idx => services[idx].id);
    
    console.log('\nSelected services:');
    selectedIndices.forEach(idx => {
      console.log(`  - ${services[idx].name} (₹${services[idx].basePrice})`);
    });
    const confirm = await question('\nSubmit request? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Booking cancelled');
      rl.close();
      return;
    }
    const requestId = uuidv4();
    const request: BookingRequest = {
      requestId,
      user: {
        name: name.trim(),
        gender,
        dateOfBirth: dob.trim()
      },
      selectedServices,
      timestamp: new Date().toISOString()
    };
    
    console.log('\nSubmitting booking request...\n');
    await initiateBooking(request);
    await pollBookingStatus(requestId);
    
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  } finally {
    main();
  }
}

if (require.main === module) {
  main().catch(console.error);
}
