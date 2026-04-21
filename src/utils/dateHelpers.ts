import { isHoliday as checkIsHoliday } from './holidays';

export const formatDateToLocalString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

export const isBusinessDay = (date: Date): boolean => {
  return !isWeekend(date) && !checkIsHoliday(date);
};

export const getNextBusinessDay = (date: Date): Date => {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  while (!isBusinessDay(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }

  return nextDay;
};

export const addBusinessDays = (startDate: Date, days: number): Date => {
  let currentDate = new Date(startDate);
  const direction = days >= 0 ? 1 : -1;
  const absDays = Math.abs(days);
  let businessDaysAdded = 0;

  while (businessDaysAdded < absDays) {
    currentDate.setDate(currentDate.getDate() + direction);

    if (isBusinessDay(currentDate)) {
      businessDaysAdded++;
    }
  }

  return currentDate;
};

export const getDayOfWeekJapanese = (date: Date): string => {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
};

export const formatDateWithDayOfWeek = (dateString: string): string => {
  const date = new Date(dateString);
  const dayOfWeek = getDayOfWeekJapanese(date);
  const isHolidayDay = checkIsHoliday(date);
  const isWeekendDay = isWeekend(date);

  const formatted = date.toLocaleDateString('ja-JP');

  if (isHolidayDay) {
    return `${formatted} (${dayOfWeek}・祝)`;
  } else if (isWeekendDay) {
    return `${formatted} (${dayOfWeek})`;
  } else {
    return `${formatted} (${dayOfWeek})`;
  }
};

export const isLutetiumDeliveryDay = (date: Date): boolean => {
  const day = date.getDay();
  return day === 2 || day === 4;
};

/**
 * ルタテラ：入院日（治療日の１営業日前）
 * 土日祝日をスキップして1営業日前を計算
 */
export const getLutetiumAdmissionDate = (treatmentDate: Date): Date => {
  return addBusinessDays(treatmentDate, -1);
};

/**
 * ルタテラ：退院日（治療日の翌日）
 */
export const getLutetiumDischargeDate = (treatmentDate: Date): Date => {
  const discharge = new Date(treatmentDate);
  discharge.setDate(discharge.getDate() + 1);
  return discharge;
};

/**
 * プルヴィクト：入院日（治療日の１営業日前）
 * 土日祝日をスキップして1営業日前を計算
 */
export const getLuPsmaAdmissionDate = (treatmentDate: Date): Date => {
  return addBusinessDays(treatmentDate, -1);
};

/**
 * プルヴィクト：退院日（治療日の翌々日）
 */
export const getLuPsmaDischargeDate = (treatmentDate: Date): Date => {
  const discharge = new Date(treatmentDate);
  discharge.setDate(discharge.getDate() + 2);
  return discharge;
};

export const isLuPsmaDeliveryDay = (date: Date): boolean => {
  const day = date.getDay();
  return day >= 1 && day <= 5;
};

/**
 * 入院・治療・退院の全ての日が営業日かチェック
 */
export const areAllDatesBusinessDays = (
  admissionDate: Date,
  treatmentDate: Date,
  dischargeDate: Date
): boolean => {
  return (
    isBusinessDay(admissionDate) &&
    isBusinessDay(treatmentDate) &&
    isBusinessDay(dischargeDate)
  );
};

export const getNonDeliveryPeriods2025 = (): Array<{ start: string; end: string; name: string }> => {
  return [
    { start: '2025-08-11', end: '2025-08-15', name: 'お盆休み' },
    { start: '2025-12-29', end: '2026-01-03', name: '年末年始' }
  ];
};

export const getNonDeliveryPeriods2026 = (): Array<{ start: string; end: string; name: string }> => {
  return [
    { start: '2026-08-10', end: '2026-08-14', name: 'お盆休み' },
    { start: '2026-12-28', end: '2027-01-03', name: '年末年始' }
  ];
};

export const isInNonDeliveryPeriod = (date: Date): boolean => {
  const dateStr = date.toISOString().split('T')[0];
  const allPeriods = [...getNonDeliveryPeriods2025(), ...getNonDeliveryPeriods2026()];

  for (const period of allPeriods) {
    if (dateStr >= period.start && dateStr <= period.end) {
      return true;
    }
  }

  return false;
};

export const isDayAfterHoliday = (date: Date): boolean => {
  const previousDay = new Date(date);
  previousDay.setDate(date.getDate() - 1);
  return checkIsHoliday(previousDay) || isWeekend(previousDay);
};

export const hasNonBusinessDayBetween = (startDate: Date, endDate: Date): boolean => {
  const current = new Date(startDate);

  while (current <= endDate) {
    if (!isBusinessDay(current)) {
      return true;
    }
    current.setDate(current.getDate() + 1);
  }

  return false;
};

export const canDeliverTreatment = (
  date: Date,
  treatmentType: 'lu-psma' | 'lutetium'
): boolean => {
  if (!isBusinessDay(date)) return false;

  if (isInNonDeliveryPeriod(date)) return false;

  if (isDayAfterHoliday(date)) return false;

  if (treatmentType === 'lutetium') {
    return isLutetiumDeliveryDay(date);
  } else {
    return isLuPsmaDeliveryDay(date);
  }
};

export const getNextDeliveryDay = (
  startDate: Date,
  treatmentType: 'lu-psma' | 'lutetium'
): Date => {
  let testDate = new Date(startDate);
  let attempts = 0;
  const maxAttempts = 365;

  while (attempts < maxAttempts) {
    if (canDeliverTreatment(testDate, treatmentType)) {
      return testDate;
    }
    testDate.setDate(testDate.getDate() + 1);
    attempts++;
  }

  return startDate;
};

export const getJapaneseHolidays2025 = (): Array<{ date: string; name: string }> => {
  return [
    { date: '2025-01-01', name: '元日' },
    { date: '2025-01-13', name: '成人の日' },
    { date: '2025-02-11', name: '建国記念の日' },
    { date: '2025-02-23', name: '天皇誕生日' },
    { date: '2025-02-24', name: '振替休日' },
    { date: '2025-03-20', name: '春分の日' },
    { date: '2025-04-29', name: '昭和の日' },
    { date: '2025-05-03', name: '憲法記念日' },
    { date: '2025-05-04', name: 'みどりの日' },
    { date: '2025-05-05', name: 'こどもの日' },
    { date: '2025-05-06', name: '振替休日' },
    { date: '2025-07-21', name: '海の日' },
    { date: '2025-08-11', name: '山の日' },
    { date: '2025-09-15', name: '敬老の日' },
    { date: '2025-09-23', name: '秋分の日' },
    { date: '2025-10-13', name: 'スポーツの日' },
    { date: '2025-11-03', name: '文化の日' },
    { date: '2025-11-23', name: '勤労感謝の日' },
    { date: '2025-11-24', name: '振替休日' }
  ];
};

export const getJapaneseHolidays2026 = (): Array<{ date: string; name: string }> => {
  return [
    { date: '2026-01-01', name: '元日' },
    { date: '2026-01-12', name: '成人の日' },
    { date: '2026-02-11', name: '建国記念の日' },
    { date: '2026-02-23', name: '天皇誕生日' },
    { date: '2026-03-20', name: '春分の日' },
    { date: '2026-04-29', name: '昭和の日' },
    { date: '2026-05-03', name: '憲法記念日' },
    { date: '2026-05-04', name: 'みどりの日' },
    { date: '2026-05-05', name: 'こどもの日' },
    { date: '2026-05-06', name: '振替休日' },
    { date: '2026-07-20', name: '海の日' },
    { date: '2026-08-11', name: '山の日' },
    { date: '2026-09-21', name: '敬老の日' },
    { date: '2026-09-22', name: '国民の休日' },
    { date: '2026-09-23', name: '秋分の日' },
    { date: '2026-10-12', name: 'スポーツの日' },
    { date: '2026-11-03', name: '文化の日' },
    { date: '2026-11-23', name: '勤労感謝の日' }
  ];
};
