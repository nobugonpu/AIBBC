import { Trash2 } from 'lucide-react';
import type { SavedSchedule } from '../../shared/contracts/scheduler';

interface SavedSchedulesListProps {
  schedules: SavedSchedule[];
  onLoad: (schedule: SavedSchedule) => void;
  onDelete: (id: string) => void;
}

export function SavedSchedulesList({ schedules, onLoad, onDelete }: SavedSchedulesListProps) {
  if (schedules.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">保存されたスケジュール</h3>
      <div className="space-y-3">
        {schedules.map((schedule) => (
          <div
            key={schedule.id}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex-1">
              <div className="font-medium text-gray-900">{schedule.schedule_name}</div>
              <div className="text-sm text-gray-600 mt-1">
                Lu-PSMA: {schedule.lu_psma_count}回 | ルタテラ: {schedule.lutetium_count}回 |
                使用日数: {schedule.total_days_used}/{schedule.total_days_available}日
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(schedule.created_at).toLocaleString('ja-JP')}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onLoad(schedule)}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                読み込む
              </button>
              <button
                onClick={() => onDelete(schedule.id)}
                className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
