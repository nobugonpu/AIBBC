import { Clock, Printer, Trash2 } from 'lucide-react';
import type { Patient, Cycle, TreatmentInfoMap } from '../../shared/contracts/patient';

interface PatientListProps {
  patients: Patient[];
  cycles: Cycle[];
  treatmentInfo: TreatmentInfoMap;
  onDelete: (id: string) => void;
  onPrint: (id: string) => void;
}

export function PatientList({ patients, cycles, treatmentInfo, onDelete, onPrint }: PatientListProps) {
  if (patients.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">登録患者一覧</h3>
      <div className="space-y-3">
        {patients.map((patient) => {
          const info = treatmentInfo[patient.treatment_type];
          const patientCycles = cycles.filter(c => c.patient_id === patient.id);
          const nextCycle = patientCycles.find(c => c.status === 'scheduled' && new Date(c.scheduled_date) >= new Date());

          return (
            <div
              key={patient.id}
              className={`p-4 rounded-lg border-2 ${
                info.color === 'blue' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="font-semibold text-gray-900 text-lg">{patient.patient_name}</div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      info.color === 'blue' ? 'bg-blue-200 text-blue-900' : 'bg-green-200 text-green-900'
                    }`}>
                      {info.name}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>開始日: {new Date(patient.start_date).toLocaleDateString('ja-JP')}</div>
                    <div>進捗: {patient.cycles_completed} / {patient.cycles_planned} サイクル完了</div>
                    {nextCycle && (
                      <div className="flex items-center gap-2 mt-2 text-blue-700 font-medium">
                        <Clock className="w-4 h-4" />
                        次回予定: {new Date(nextCycle.scheduled_date).toLocaleDateString('ja-JP')} (第{nextCycle.cycle_number}サイクル)
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onPrint(patient.id)}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    title="タイムライン印刷"
                  >
                    <Printer className="w-4 h-4" />
                    印刷
                  </button>
                  <button
                    onClick={() => onDelete(patient.id)}
                    className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
