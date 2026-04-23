import { Plus, Target } from 'lucide-react';
import type { OptimizationObjective } from '../../shared/contracts/scheduler';

interface SchedulerFormProps {
  totalDays: string;
  periodMonths: string;
  weeklyCapacity: string;
  startDate: string;
  objective: OptimizationObjective;
  onTotalDaysChange: (value: string) => void;
  onPeriodMonthsChange: (value: string) => void;
  onWeeklyCapacityChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onObjectiveChange: (value: OptimizationObjective) => void;
  onCalculate: () => void;
}

export function SchedulerForm({
  totalDays,
  periodMonths,
  weeklyCapacity,
  startDate,
  objective,
  onTotalDaysChange,
  onPeriodMonthsChange,
  onWeeklyCapacityChange,
  onStartDateChange,
  onObjectiveChange,
  onCalculate
}: SchedulerFormProps) {
  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">治療情報</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>Lu-PSMA-617: 3日入院（投与前日入院、投与後2日）、6週間（42日）間隔で最大6回、治療期間約9か月</li>
          <li>ルタテラ: 2日入院（投与前日入院、投与後1泊）、8週間（56日）間隔で最大4回、治療期間約6か月</li>
          <li>週キャパ制約: 1週間に最大1件のLu-177治療</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <label htmlFor="periodMonths" className="block text-sm font-medium text-gray-700 mb-2">
            期間（月）
          </label>
          <input
            id="periodMonths"
            type="number"
            value={periodMonths}
            onChange={(e) => onPeriodMonthsChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="totalDays" className="block text-sm font-medium text-gray-700 mb-2">
            使用可能日数（合計）
          </label>
          <input
            id="totalDays"
            type="number"
            value={totalDays}
            onChange={(e) => onTotalDaysChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="weeklyCapacity" className="block text-sm font-medium text-gray-700 mb-2">
            週あたりLu-177最大件数
          </label>
          <input
            id="weeklyCapacity"
            type="number"
            value={weeklyCapacity}
            onChange={(e) => onWeeklyCapacityChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
            期間開始日
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="objective" className="block text-sm font-medium text-gray-700 mb-2">
            <Target className="inline w-4 h-4 mr-1" />
            最適化の目的
          </label>
          <select
            id="objective"
            value={objective}
            onChange={(e) => onObjectiveChange(e.target.value as OptimizationObjective)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="maximize_total">総投与回数を最大化</option>
            <option value="maximize_lupsma">Lu-PSMAをできるだけ多く</option>
            <option value="minimize_unused">未使用日数を最小化（≦制約）</option>
            <option value="exact_capacity">使用可能日数ぴったり充足</option>
          </select>
        </div>
      </div>

      <button
        onClick={onCalculate}
        className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        最適パターンを計算
      </button>
    </div>
  );
}
