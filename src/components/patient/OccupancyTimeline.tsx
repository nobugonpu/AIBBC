import { isWeekend, isBusinessDay, formatDateWithDayOfWeek } from '../../utils/dateHelpers';
import { isHoliday as checkIsHoliday } from '../../utils/holidays';
import type { Patient, Cycle, OccupiedSlot, TreatmentInfoMap } from '../../shared/contracts/patient';

interface OccupancyTimelineProps {
  patients: Patient[];
  cycles: Cycle[];
  occupiedSlots: OccupiedSlot[];
  treatmentInfo: TreatmentInfoMap;
}

export function OccupancyTimeline({ patients, cycles, occupiedSlots, treatmentInfo }: OccupancyTimelineProps) {
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-700">日付</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700">患者名</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700">治療タイプ</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700">サイクル</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {occupiedSlots.slice(0, 60).map((slot, index) => {
              const date = new Date(slot.date);
              const isWeekendDay = isWeekend(date);
              const isHolidayDay = checkIsHoliday(date);

              return (
                <tr key={index} className={`hover:bg-gray-50 ${
                  isWeekendDay || isHolidayDay ? 'bg-red-50' : ''
                }`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {formatDateWithDayOfWeek(slot.date)}
                      {(isWeekendDay || isHolidayDay) && (
                        <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded">
                          休日
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{slot.patientName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      slot.treatmentType.includes('プルヴィクト')
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {slot.treatmentType}
                    </span>
                  </td>
                  <td className="px-4 py-3">第{slot.cycleNumber}サイクル</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        {patients.map((patient) => {
          const info = treatmentInfo[patient.treatment_type];
          const patientCycles = cycles
            .filter(c => c.patient_id === patient.id)
            .sort((a, b) => a.cycle_number - b.cycle_number);

          return (
            <div key={patient.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="font-semibold text-gray-900">{patient.patient_name}</div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  info.color === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                }`}>
                  {info.name}
                </span>
              </div>
              <div className="space-y-2">
                {patientCycles.map((cycle) => {
                  const admissionDate = new Date(cycle.admission_date);
                  const dischargeDate = new Date(cycle.discharge_date);

                  const businessDaysInCycle = [];
                  const currentDate = new Date(admissionDate);
                  while (currentDate <= dischargeDate) {
                    if (isBusinessDay(currentDate)) {
                      businessDaysInCycle.push(new Date(currentDate));
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                  }

                  return (
                    <div key={cycle.id} className="flex items-center gap-3 text-sm">
                      <div className="w-24 text-gray-600">第{cycle.cycle_number}サイクル</div>
                      <div className={`flex-1 h-8 rounded flex items-center px-3 text-white font-medium ${
                        cycle.status === 'completed'
                          ? 'bg-gray-400'
                          : cycle.status === 'cancelled'
                          ? 'bg-red-400'
                          : info.color === 'blue'
                          ? 'bg-blue-500'
                          : 'bg-green-500'
                      }`}>
                        {formatDateWithDayOfWeek(cycle.admission_date)} - {formatDateWithDayOfWeek(cycle.discharge_date)}
                        <span className="ml-2 text-xs opacity-80">
                          ({businessDaysInCycle.length}営業日)
                        </span>
                      </div>
                      <div className="w-20 text-gray-600 text-right">
                        {cycle.status === 'completed' ? '完了' : cycle.status === 'cancelled' ? 'キャンセル' : '予定'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
