import { Plus } from 'lucide-react';
import type { TreatmentType, TreatmentInfoMap } from '../../shared/contracts/patient';

interface PatientFormProps {
  newPatient: {
    name: string;
    treatmentType: TreatmentType;
    startDate: string;
    cyclesPlanned: number;
  };
  setNewPatient: (patient: any) => void;
  onAdd: () => void;
  loading: boolean;
  treatmentInfo: TreatmentInfoMap;
  setMessage: (message: { type: 'success' | 'error'; text: string } | null) => void;
}

export function PatientForm({ newPatient, setNewPatient, onAdd, loading, treatmentInfo, setMessage }: PatientFormProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">新規患者登録</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <div>
          <label htmlFor="patientName" className="block text-sm font-medium text-gray-700 mb-2">
            患者名
          </label>
          <input
            id="patientName"
            type="text"
            value={newPatient.name}
            onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="患者名を入力"
          />
        </div>

        <div>
          <label htmlFor="treatmentType" className="block text-sm font-medium text-gray-700 mb-2">
            治療タイプ
          </label>
          <select
            id="treatmentType"
            value={newPatient.treatmentType}
            onChange={(e) => {
              const type = e.target.value as 'lu-psma' | 'lutetium';
              setNewPatient({
                ...newPatient,
                treatmentType: type,
                cyclesPlanned: treatmentInfo[type].maxCycles
              });
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="lu-psma">プルヴィクト（Lu-PSMA-617）</option>
            <option value="lutetium">ルタテラ</option>
          </select>
        </div>

        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
            治療開始日 {newPatient.treatmentType === 'lutetium' && <span className="text-red-600 text-xs">(火曜・木曜のみ)</span>}
          </label>
          <input
            id="startDate"
            type="date"
            value={newPatient.startDate}
            onChange={(e) => {
              const selectedDate = new Date(e.target.value);
              if (newPatient.treatmentType === 'lutetium') {
                const dayOfWeek = selectedDate.getDay();
                if (dayOfWeek !== 2 && dayOfWeek !== 4) {
                  setMessage({ type: 'error', text: 'ルタテラの治療日は火曜日または木曜日のみ選択できます' });
                  return;
                }
              }
              setNewPatient({ ...newPatient, startDate: e.target.value });
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="cyclesPlanned" className="block text-sm font-medium text-gray-700 mb-2">
            予定サイクル数
          </label>
          <input
            id="cyclesPlanned"
            type="number"
            min="1"
            max={treatmentInfo[newPatient.treatmentType].maxCycles}
            value={newPatient.cyclesPlanned}
            onChange={(e) => setNewPatient({ ...newPatient, cyclesPlanned: parseInt(e.target.value) })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={onAdd}
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            患者追加
          </button>
        </div>
      </div>
    </div>
  );
}
