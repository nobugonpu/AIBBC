import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isHoliday as checkIsHoliday } from '../../utils/holidays';

interface OccupiedSlot {
  date: string;
  patientName: string;
  treatmentType: string;
  cycleNumber: number;
  isAdmission?: boolean;
  isDischarge?: boolean;
  isTreatmentDay?: boolean;
}

interface OccupancyCalendarProps {
  currentMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  getTreatmentsForDate: (date: Date) => OccupiedSlot[];
}

export function OccupancyCalendar({ currentMonth, onPreviousMonth, onNextMonth, getTreatmentsForDate }: OccupancyCalendarProps) {
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 no-print">
        <button
          onClick={onPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h4 className="text-2xl font-bold text-gray-900">
          {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
        </h4>
        <button
          onClick={onNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      <div className="print-title">
        {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月 治療スケジュール
      </div>

      <div className="calendar-grid">
        <div className="calendar-header">日</div>
        <div className="calendar-header">月</div>
        <div className="calendar-header">火</div>
        <div className="calendar-header">水</div>
        <div className="calendar-header">木</div>
        <div className="calendar-header">金</div>
        <div className="calendar-header">土</div>

        {getCalendarDays().map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="calendar-day empty"></div>;
          }

          const treatments = getTreatmentsForDate(day);
          const isToday = day.toDateString() === new Date().toDateString();
          const isWeekendDay = day.getDay() === 0 || day.getDay() === 6;
          const isHolidayDay = checkIsHoliday(day);

          return (
            <div
              key={day.toISOString()}
              className={`calendar-day ${isToday ? 'today' : ''} ${isWeekendDay || isHolidayDay ? 'weekend' : ''}`}
            >
              <div className="calendar-day-number">
                {day.getDate()}
                {isHolidayDay && <span className="holiday-badge">祝</span>}
              </div>
              <div className="calendar-treatments">
                {treatments.map((treatment, idx) => {
                  let dayLabel = '';
                  let className = 'treatment-item ';

                  if (treatment.treatmentType.includes('プルヴィクト')) {
                    if (treatment.isAdmission) {
                      className += 'treatment-pluvicto-admission';
                      dayLabel = '入院';
                    } else if (treatment.isDischarge) {
                      className += 'treatment-pluvicto-discharge';
                      dayLabel = '退院';
                    } else if (treatment.isTreatmentDay) {
                      className += 'treatment-pluvicto';
                      dayLabel = '治療';
                    } else {
                      className += 'treatment-pluvicto';
                    }
                  } else if (treatment.treatmentType.includes('ルタテラ')) {
                    if (treatment.isAdmission) {
                      className += 'treatment-lutetium-admission';
                      dayLabel = '入院';
                    } else if (treatment.isDischarge) {
                      className += 'treatment-lutetium-discharge';
                      dayLabel = '退院';
                    } else if (treatment.isTreatmentDay) {
                      className += 'treatment-lutetium';
                      dayLabel = '治療';
                    } else {
                      className += 'treatment-lutetium';
                    }
                  }

                  return (
                    <div key={idx} className={className}>
                      <div className="treatment-patient">{treatment.patientName}</div>
                      <div className="treatment-type">
                        {treatment.treatmentType}
                        {dayLabel && <span className="ml-1 font-bold">({dayLabel})</span>}
                      </div>
                      <div className="treatment-cycle">第{treatment.cycleNumber}回</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="space-y-3">
          <div className="font-semibold text-gray-700">プルヴィクト（Lu-PSMA-617）</div>
          <div className="flex flex-wrap gap-4 text-sm ml-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500"></div>
              <span>治療日</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-pink-500"></div>
              <span>入院日</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-500"></div>
              <span>退院日</span>
            </div>
          </div>

          <div className="font-semibold text-gray-700 mt-4">ルタテラ</div>
          <div className="flex flex-wrap gap-4 text-sm ml-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span>治療日</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-500"></div>
              <span>入院日</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-indigo-500"></div>
              <span>退院日</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
