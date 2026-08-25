import { useState, useMemo } from 'react';
import { CalendarClock, AlertTriangle } from 'lucide-react';
import type { Patient, Cycle, TreatmentInfoMap } from '../../shared/contracts/patient';
import { getOrderDeadline } from '../../utils/dateHelpers';

interface UpcomingScheduleProps {
  patients: Patient[];
  cycles: Cycle[];
  treatmentInfo: TreatmentInfoMap;
  conflictingCycleIds: Set<string>;
}

type RangeDays = 30 | 60 | 90;

const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];

function fmt(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}(${dayLabels[d.getDay()]})`;
}

// Drug order deadline (Monday 17:00, two weeks before the treatment week),
// with a status flag relative to now: passed / due soon / ok.
function orderDeadlineInfo(scheduledDate: string): { label: string; status: 'passed' | 'soon' | 'ok' } {
  const dl = getOrderDeadline(new Date(scheduledDate));
  const label = `${dl.getMonth() + 1}/${dl.getDate()}(${dayLabels[dl.getDay()]}) 17時`;
  const now = new Date();
  const diffDays = (dl.getTime() - now.getTime()) / 86400000;
  const status = diffDays < 0 ? 'passed' : diffDays <= 3 ? 'soon' : 'ok';
  return { label, status };
}

export function UpcomingSchedule({ patients, cycles, treatmentInfo, conflictingCycleIds }: UpcomingScheduleProps) {
  const [range, setRange] = useState<RangeDays>(30);

  const rows = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + range);

    return cycles
      .filter(c => {
        if (c.status === 'cancelled') return false;
        const admit = new Date(c.admission_date);
        return admit >= today && admit <= limit;
      })
      .map(c => {
        const patient = patients.find(p => p.id === c.patient_id);
        return { cycle: c, patient };
      })
      .filter((r): r is { cycle: Cycle; patient: Patient } => r.patient !== undefined)
      .sort((a, b) => a.cycle.admission_date.localeCompare(b.cycle.admission_date));
  }, [cycles, patients, range]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-blue-600" />
          直近の入院予定
        </h3>
        <div className="flex gap-1">
          {([30, 60, 90] as RangeDays[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                range === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              今後{r}日
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          今後{range}日以内の入院予定はありません。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-xs font-semibold text-gray-500">入院日</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-500">治療日</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-500">発注締切</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-500">退院日</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-500">患者名</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-500">治療種別</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-500 text-center">サイクル</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cycle, patient }) => {
                const info = treatmentInfo[patient.treatment_type];
                const conflicting = conflictingCycleIds.has(cycle.id);
                return (
                  <tr
                    key={cycle.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${conflicting ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-3 py-2 text-sm font-medium text-gray-800">
                      {conflicting && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 inline mr-1 -mt-0.5" />
                      )}
                      {fmt(cycle.admission_date)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">{fmt(cycle.scheduled_date)}</td>
                    {(() => {
                      const dl = orderDeadlineInfo(cycle.scheduled_date);
                      const cls = dl.status === 'passed'
                        ? 'text-red-600 font-semibold'
                        : dl.status === 'soon'
                          ? 'text-amber-700 font-semibold'
                          : 'text-gray-700';
                      return (
                        <td className={`px-3 py-2 text-sm whitespace-nowrap ${cls}`} title="お薬の発注締切（治療日の週の2週間前 月曜17時）">
                          {dl.label}
                          {dl.status === 'passed' && <span className="ml-1 text-xs">締切済</span>}
                          {dl.status === 'soon' && <span className="ml-1 text-xs">まもなく</span>}
                        </td>
                      );
                    })()}
                    <td className="px-3 py-2 text-sm text-gray-700">{fmt(cycle.discharge_date)}</td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{patient.patient_name}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        info.color === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {info.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 text-center">第{cycle.cycle_number}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
