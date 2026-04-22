import Holidays from 'date-holidays';

const hd = new Holidays('JP');

export interface Holiday {
  date: string;
  name: string;
  type: string;
}

const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getHolidaysForYear = (year: number): Holiday[] => {
  const holidays = hd.getHolidays(year);

  return holidays
    .filter(h => h.type === 'public')
    .map(h => ({
      date: formatDateLocal(new Date(h.date)),
      name: h.name,
      type: h.type
    }));
};

export const getHolidaysForRange = (startYear: number, endYear: number): Holiday[] => {
  const allHolidays: Holiday[] = [];

  for (let year = startYear; year <= endYear; year++) {
    allHolidays.push(...getHolidaysForYear(year));
  }

  return allHolidays;
};

export const isHoliday = (date: Date): boolean => {
  const dateStr = formatDateLocal(date);
  const year = date.getFullYear();
  const yearHolidays = getHolidaysForYear(year);

  return yearHolidays.some(h => h.date === dateStr);
};

export const getHolidayName = (date: Date): string | null => {
  const dateStr = formatDateLocal(date);
  const year = date.getFullYear();
  const yearHolidays = getHolidaysForYear(year);

  const holiday = yearHolidays.find(h => h.date === dateStr);
  return holiday ? holiday.name : null;
};
