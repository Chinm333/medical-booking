export function getISTDate(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString().split('T')[0]; 
}

export function getISTDateTime(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString();
}

export function isTodayBirthday(dateOfBirth: string): boolean {
  const dob = new Date(dateOfBirth);
  const today = new Date(getISTDate());
  
  return dob.getMonth() === today.getMonth() && 
         dob.getDate() === today.getDate();
}

export function getISTMidnightTimestamp(): number {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  istTime.setHours(0, 0, 0, 0);
  return istTime.getTime();
}
