import axios from 'axios';
import { HolidayResponse } from '../types';
import { getISTDate } from '../utils/date';

const HOLIDAY_API_URL = process.env.HOLIDAY_API_URL+`?api_key=${process.env.API_KEY}&country=${process.env.COUNTRY_CODE}`;
const YEAR = new Date().getFullYear();

const FALLBACK_HOLIDAYS: Record<string, string> = {
  '2024-01-26': 'Republic Day',
  '2024-03-29': 'Good Friday',
  '2024-08-15': 'Independence Day',
  '2024-10-02': 'Gandhi Jayanti',
  '2024-10-31': 'Diwali',
  '2024-11-01': 'Diwali',
  '2025-01-26': 'Republic Day',
  '2025-03-29': 'Holi',
  '2025-08-15': 'Independence Day',
  '2025-10-02': 'Gandhi Jayanti',
  '2025-10-20': 'Diwali',
  '2025-10-21': 'Diwali',
  '2026-01-26': 'Republic Day',
  '2026-08-15': 'Independence Day',
  '2026-10-02': 'Gandhi Jayanti',
  '2026-11-08': 'Diwali',
  '2026-11-09': 'Diwali'
};

export async function checkIfHoliday(): Promise<HolidayResponse> {
  const today = getISTDate();
  
  try {
    const response = await axios.get(`${HOLIDAY_API_URL}&year=${YEAR}`, {
      timeout: 5000
    });
    
    const holidays = response.data.response.holidays;
    
    const todayHoliday = holidays.find((h: any) => h.date.iso === today);
    
    if (todayHoliday) {
      return {
        isHoliday: true,
        holidayName: todayHoliday.name
      };
    }
    
    return { isHoliday: false };
  } catch (error) {
    console.warn('Holiday API failed, using fallback data:', error instanceof Error ? error.message : error);
    
    const holidayName = FALLBACK_HOLIDAYS[today];
    if (holidayName) {
      return {
        isHoliday: true,
        holidayName,
        error: 'API unavailable, used fallback data'
      };
    }
    
    return {
      isHoliday: false,
      error: 'API unavailable, no holiday found in fallback data'
    };
  }
}
