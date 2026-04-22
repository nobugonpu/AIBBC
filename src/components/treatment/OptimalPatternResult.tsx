import { CheckCircle, AlertCircle, Save, Download } from 'lucide-react';

interface TreatmentEvent {
  type: 'lu-psma' | 'lutetium';
  startDay: number;
  endDay: number;
  cycleNumber: number;
  weekNumber: number;
}

interface OptimalPattern {
  luPsmaCount: number;
  lutetiumCount: number;
  totalDaysUsed: number;
  unusedDays: number;
  totalTreatments: number;
  schedule: TreatmentEvent[];
  weeklyCapacitySatisfied: boolean;
  minPatientsLuPsma: number;
  minPatientsLutetium: number;
}

interface OptimalPatternResultProps {
  pattern: OptimalPattern;
  totalDays: string;
  startDate: string;
  objectiveName: string;
  scheduleName: string;
  loading: boolean;
  onScheduleNameChange: (value: string) => void;
  onSave: () => void;
  onExport: () => void;
}

export function OptimalPatternResult({
  pattern,
  totalDays,
  startDate,
  objectiveName,
  scheduleName,
  loading,
  onScheduleNameChange,
  onSave,
  onExport
}: OptimalPatternResultProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <CheckCircle className="w-6 h-6 text-green-600" />
        最適パターン（{objectiveName}）
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
          <div className="text-sm font-medium text-gray-600 mb-1">Lu-PSMA-617</div>
          <div className="text-3xl font-bold text-blue-600">{pattern.luPsmaCount}回</div>
          <div className="text-xs text-gray-500 mt-1">3日 × {pattern.luPsmaCount} = {pattern.luPsmaCount * 3}日</div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
          <div className="text-sm font-medium text-gray-600 mb-1">ルタテラ</div>
          <div className="text-3xl font-bold text-green-600">{pattern.lutetiumCount}回</div>
          <div className="text-xs text-gray-500 mt-1">2日 × {pattern.lutetiumCount} = {pattern.lutetiumCount * 2}日</div>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
          <div className="text-sm font-medium text-gray-600 mb-1">総投与回数</div>
          <div className="text-3xl font-bold text-orange-600">{pattern.totalTreatments}回</div>
          <div className="text-xs text-gray-500 mt-1">Lu-PSMA + ルタテラ</div>
        </div>

        <div className={`p-4 rounded-lg border-2 ${pattern.unusedDays === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="text-sm font-medium text-gray-600 mb-1">使用日数</div>
          <div className={`text-3xl font-bold ${pattern.unusedDays === 0 ? 'text-green-600' : 'text-yellow-600'}`}>
            {pattern.totalDaysUsed}/{totalDays}日
          </div>
          <div className="text-xs text-gray-500 mt-1">未使用: {pattern.unusedDays}日</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm font-medium text-gray-700 mb-2">週キャパ充足</div>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
            pattern.weeklyCapacitySatisfied
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {pattern.weeklyCapacitySatisfied ? (
              <>
                <CheckCircle className="w-4 h-4" />
                充足
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4" />
                不足
              </>
            )}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm font-medium text-gray-700 mb-2">必要最小患者数</div>
          <div className="text-sm text-gray-600">
            Lu-PSMA: <span className="font-semibold">{pattern.minPatientsLuPsma}名</span> /
            ルタテラ: <span className="font-semibold">{pattern.minPatientsLutetium}名</span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-semibold text-gray-900 mb-3">週次スケジュール</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">週</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">治療タイプ</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">サイクル</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">開始日</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">終了日</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">入院日数</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">開始日付</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">終了日付</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pattern.schedule.map((event, index) => {
                const start = new Date(startDate);
                const eventStartDate = new Date(start);
                eventStartDate.setDate(start.getDate() + event.startDay);
                const eventEndDate = new Date(start);
                eventEndDate.setDate(start.getDate() + event.endDay);

                return (
                  <tr key={index} className={event.type === 'lu-psma' ? 'bg-blue-50' : 'bg-green-50'}>
                    <td className="px-4 py-3 font-medium">第{event.weekNumber}週</td>
                    <td className="px-4 py-3 font-medium">
                      {event.type === 'lu-psma' ? 'Lu-PSMA-617' : 'ルタテラ'}
                    </td>
                    <td className="px-4 py-3">{event.cycleNumber}</td>
                    <td className="px-4 py-3">{event.startDay + 1}日目</td>
                    <td className="px-4 py-3">{event.endDay + 1}日目</td>
                    <td className="px-4 py-3">{event.endDay - event.startDay + 1}日</td>
                    <td className="px-4 py-3">{eventStartDate.toLocaleDateString('ja-JP')}</td>
                    <td className="px-4 py-3">{eventEndDate.toLocaleDateString('ja-JP')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <input
            type="text"
            value={scheduleName}
            onChange={(e) => onScheduleNameChange(e.target.value)}
            placeholder="スケジュール名を入力..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={onSave}
            disabled={loading || !scheduleName.trim()}
            className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            スケジュールを保存
          </button>
        </div>

        <button
          onClick={onExport}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          CSVでエクスポート
        </button>
      </div>
    </div>
  );
}
