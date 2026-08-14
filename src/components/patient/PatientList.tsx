import { useState, useMemo } from 'react';
import { Clock, Printer, Trash2, ChevronDown, ChevronUp, Pencil, Check, X, AlertTriangle, FileText } from 'lucide-react';
import type { Patient, Cycle, TreatmentInfoMap, CycleStatus, TreatmentType } from '../../shared/contracts/patient';
import {
  getLuPsmaAdmissionDate, getLuPsmaDischargeDate,
  getLutetiumAdmissionDate, getLutetiumDischargeDate,
  formatDateToLocalString,
} from '../../utils/dateHelpers';

// Admission/discharge derived from the treatment date (same rule as scheduling).
function stayFromTreatment(treatmentType: TreatmentType, treatDate: string): { admissionDate: string; dischargeDate: string } {
  if (!treatDate) return { admissionDate: '', dischargeDate: '' };
  const t = new Date(treatDate);
  const admit = treatmentType === 'lutetium' ? getLutetiumAdmissionDate(t) : getLuPsmaAdmissionDate(t);
  const dis = treatmentType === 'lutetium' ? getLutetiumDischargeDate(t) : getLuPsmaDischargeDate(t);
  return { admissionDate: formatDateToLocalString(admit), dischargeDate: formatDateToLocalString(dis) };
}

export interface CycleUpdatePayload {
  scheduledDate: string;
  admissionDate: string;
  dischargeDate: string;
  status: CycleStatus;
  notes: string;
}

interface PatientListProps {
  patients: Patient[];
  cycles: Cycle[];
  treatmentInfo: TreatmentInfoMap;
  onDelete: (id: string) => void;
  onPrint: (id: string) => void;
  onPrintForPatient: (id: string) => void;
  onCycleUpdate: (id: string, update: CycleUpdatePayload, recalculate: boolean) => Promise<void>;
  onCyclePostpone: (id: string, days: number, recalculate: boolean) => Promise<void>;
}

const STATUS_LABELS: Record<CycleStatus, string> = {
  scheduled: '予定',
  completed: '完了',
  cancelled: 'キャンセル',
};

const STATUS_COLORS: Record<CycleStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

function CycleEditRow({
  cycle,
  treatmentType,
  hasSubsequent,
  onSave,
  onCancel,
}: {
  cycle: Cycle;
  treatmentType: TreatmentType;
  hasSubsequent: boolean;
  onSave: (update: CycleUpdatePayload, recalculate: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const [scheduledDate, setScheduledDate] = useState(cycle.scheduled_date);
  const [status, setStatus] = useState<CycleStatus>(cycle.status);
  const [notes, setNotes] = useState(cycle.notes ?? '');
  const [recalculate, setRecalculate] = useState(false);
  const [saving, setSaving] = useState(false);

  const dateChanged = scheduledDate !== cycle.scheduled_date;
  // Admission/discharge always follow the treatment date automatically.
  const stay = stayFromTreatment(treatmentType, scheduledDate);
  const fmtJp = (s: string) => (s ? new Date(s).toLocaleDateString('ja-JP') : '—');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(
        { scheduledDate, admissionDate: stay.admissionDate, dischargeDate: stay.dischargeDate, status, notes },
        recalculate && dateChanged,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <tr className="bg-amber-50">
        <td className="px-3 py-2 text-center text-sm font-medium text-gray-700">
          第{cycle.cycle_number}
        </td>
        <td className="px-3 py-2">
          <input
            type="date"
            value={scheduledDate}
            onChange={e => setScheduledDate(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          />
        </td>
        <td className="px-3 py-2 text-xs text-gray-400">—</td>
        <td className="px-3 py-2 text-xs text-gray-600" title="治療日から自動計算">{fmtJp(stay.admissionDate)}</td>
        <td className="px-3 py-2 text-xs text-gray-600" title="治療日から自動計算">{fmtJp(stay.dischargeDate)}</td>
        <td className="px-3 py-2">
          <select
            value={status}
            onChange={e => setStatus(e.target.value as CycleStatus)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          >
            <option value="scheduled">予定</option>
            <option value="completed">完了</option>
            <option value="cancelled">キャンセル</option>
          </select>
        </td>
        <td className="px-3 py-2">
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="メモを入力"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          />
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              title="保存"
              className="p-1.5 rounded text-green-600 hover:bg-green-100 disabled:opacity-40 transition-colors"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              title="キャンセル"
              className="p-1.5 rounded text-red-500 hover:bg-red-100 disabled:opacity-40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {hasSubsequent && dateChanged && (
        <tr className="bg-amber-50 border-t border-amber-200">
          <td colSpan={8} className="px-4 pb-2 pt-1">
            <label className="flex items-center gap-2 text-xs text-amber-800 cursor-pointer select-none w-fit">
              <input
                type="checkbox"
                checked={recalculate}
                onChange={e => setRecalculate(e.target.checked)}
                className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              />
              後続サイクルを治療間隔から自動再計算する
            </label>
          </td>
        </tr>
      )}
    </>
  );
}

function CycleViewRow({
  cycle,
  isConflicting,
  intervalDays,
  standardInterval,
  onEdit,
  onPostpone,
}: {
  cycle: Cycle;
  isConflicting: boolean;
  intervalDays: number | null;
  standardInterval: number;
  onEdit: () => void;
  onPostpone: (days: number) => Promise<void>;
}) {
  const [postponing, setPostponing] = useState(false);
  const canPostpone = cycle.status === 'scheduled';

  const handlePostpone = async (days: number) => {
    setPostponing(true);
    try {
      await onPostpone(days);
    } finally {
      setPostponing(false);
    }
  };

  // Deviation from the standard interval (0 = exactly on schedule).
  const deviation = intervalDays === null ? 0 : intervalDays - standardInterval;

  return (
    <tr className={`border-b border-gray-100 hover:bg-gray-50 ${isConflicting ? 'bg-red-50' : ''}`}>
      <td className="px-3 py-2 text-center text-sm font-medium text-gray-600">
        第{cycle.cycle_number}
        {isConflicting && (
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 inline ml-1" title="他の患者と日程が重複しています" />
        )}
      </td>
      <td className="px-3 py-2 text-sm text-gray-700">
        {new Date(cycle.scheduled_date).toLocaleDateString('ja-JP')}
      </td>
      <td className="px-3 py-2 text-sm whitespace-nowrap">
        {intervalDays === null ? (
          <span className="text-gray-300">—</span>
        ) : (
          <span
            className={deviation === 0 ? 'text-gray-600' : 'text-amber-700 font-medium'}
            title={`標準間隔 ${standardInterval}日`}
          >
            {intervalDays}日{deviation !== 0 && `（${deviation > 0 ? '+' : ''}${deviation}）`}
          </span>
        )}
      </td>
      <td className={`px-3 py-2 text-sm ${isConflicting ? 'text-red-700 font-medium' : 'text-gray-700'}`}>
        {new Date(cycle.admission_date).toLocaleDateString('ja-JP')}
      </td>
      <td className={`px-3 py-2 text-sm ${isConflicting ? 'text-red-700 font-medium' : 'text-gray-700'}`}>
        {new Date(cycle.discharge_date).toLocaleDateString('ja-JP')}
      </td>
      <td className="px-3 py-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cycle.status as CycleStatus]}`}>
          {STATUS_LABELS[cycle.status as CycleStatus] ?? cycle.status}
        </span>
      </td>
      <td className="px-3 py-2 text-sm text-gray-500 max-w-[160px] truncate">
        {cycle.notes || <span className="text-gray-300">—</span>}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 justify-end">
          {canPostpone && (
            <>
              {[
                { d: -7, label: '−7日' },
                { d: 7, label: '+7日' },
                { d: 14, label: '+14日' },
                { d: 21, label: '+21日' },
              ].map(o => (
                <button
                  key={o.d}
                  onClick={() => handlePostpone(o.d)}
                  disabled={postponing}
                  title={o.d < 0 ? `この回以降を${-o.d}日前倒し` : `この回以降を${o.d}日延期（最長16週まで）`}
                  className="px-1.5 py-0.5 text-xs rounded text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 transition-colors"
                >
                  {o.label}
                </button>
              ))}
            </>
          )}
          <button
            onClick={onEdit}
            title="編集"
            className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function PatientList({
  patients,
  cycles,
  treatmentInfo,
  onDelete,
  onPrint,
  onPrintForPatient,
  onCycleUpdate,
  onCyclePostpone,
}: PatientListProps) {
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null);

  const conflictingCycleIds = useMemo(() => {
    const ids = new Set<string>();
    const active = cycles.filter(c => c.status !== 'cancelled');
    for (let i = 0; i < active.length; i++) {
      const a = active[i];
      const aAdmit = new Date(a.admission_date).getTime();
      const aDischarge = new Date(a.discharge_date).getTime();
      for (let j = i + 1; j < active.length; j++) {
        const b = active[j];
        const bAdmit = new Date(b.admission_date).getTime();
        const bDischarge = new Date(b.discharge_date).getTime();
        if (aAdmit <= bDischarge && aDischarge >= bAdmit) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [cycles]);

  const toggleExpand = (patientId: string) => {
    setExpandedPatients(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) {
        next.delete(patientId);
        setEditingCycleId(null);
      } else {
        next.add(patientId);
      }
      return next;
    });
  };

  const handleSaveCycle = async (cycleId: string, update: CycleUpdatePayload, recalculate: boolean) => {
    await onCycleUpdate(cycleId, update, recalculate);
    setEditingCycleId(null);
  };

  if (patients.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">登録患者一覧</h3>
      <div className="space-y-3">
        {patients.map(patient => {
          const info = treatmentInfo[patient.treatment_type];
          const patientCycles = cycles
            .filter(c => c.patient_id === patient.id)
            .sort((a, b) => a.cycle_number - b.cycle_number);
          const nextCycle = patientCycles.find(
            c => c.status === 'scheduled' && new Date(c.scheduled_date) >= new Date()
          );
          const isExpanded = expandedPatients.has(patient.id);

          return (
            <div
              key={patient.id}
              className={`rounded-lg border-2 ${
                info.color === 'blue' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
              }`}
            >
              {/* Patient header row */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <div className="font-semibold text-gray-900 text-lg">{patient.patient_name}</div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        info.color === 'blue' ? 'bg-blue-200 text-blue-900' : 'bg-green-200 text-green-900'
                      }`}>
                        {info.name}
                      </span>
                      {patientCycles.some(c => conflictingCycleIds.has(c.id)) && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3" />
                          日程重複あり
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>開始日: {new Date(patient.start_date).toLocaleDateString('ja-JP')}</div>
                      <div>進捗: {patient.cycles_completed} / {patient.cycles_planned} サイクル完了</div>
                      {nextCycle && (
                        <div className="flex items-center gap-2 mt-2 text-blue-700 font-medium">
                          <Clock className="w-4 h-4" />
                          次回予定: {new Date(nextCycle.scheduled_date).toLocaleDateString('ja-JP')}（第{nextCycle.cycle_number}サイクル）
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleExpand(patient.id)}
                      className={`px-3 py-2 text-sm rounded-lg border transition-colors flex items-center gap-1 ${
                        isExpanded
                          ? 'bg-gray-200 border-gray-300 text-gray-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      サイクル（{patientCycles.length}）
                    </button>
                    <button
                      onClick={() => onPrintForPatient(patient.id)}
                      className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                      title="患者さんにお渡しする、やさしい予定表を印刷"
                    >
                      <FileText className="w-4 h-4" />
                      患者用予定表
                    </button>
                    <button
                      onClick={() => onPrint(patient.id)}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      title="スタッフ用の詳細スケジュールを印刷"
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

              {/* Cycle detail table */}
              {isExpanded && (
                <div className={`border-t overflow-x-auto ${
                  info.color === 'blue' ? 'border-blue-200' : 'border-green-200'
                }`}>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white/50">
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 text-center w-16">サイクル</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500">治療日</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 w-24">前回間隔</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500">入院日</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500">退院日</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 w-24">ステータス</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500">メモ</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {patientCycles.map((cycle, idx) => {
                        const prev = idx > 0 ? patientCycles[idx - 1] : null;
                        const intervalDays = prev
                          ? Math.round(
                              (new Date(cycle.scheduled_date).getTime() - new Date(prev.scheduled_date).getTime()) / 86400000,
                            )
                          : null;
                        return editingCycleId === cycle.id ? (
                          <CycleEditRow
                            key={cycle.id}
                            cycle={cycle}
                            treatmentType={patient.treatment_type}
                            hasSubsequent={patientCycles.some(c => c.cycle_number > cycle.cycle_number && c.status !== 'cancelled')}
                            onSave={(update, recalculate) => handleSaveCycle(cycle.id, update, recalculate)}
                            onCancel={() => setEditingCycleId(null)}
                          />
                        ) : (
                          <CycleViewRow
                            key={cycle.id}
                            cycle={cycle}
                            isConflicting={conflictingCycleIds.has(cycle.id)}
                            intervalDays={intervalDays}
                            standardInterval={info.intervalDays}
                            onEdit={() => setEditingCycleId(cycle.id)}
                            onPostpone={(days) => onCyclePostpone(cycle.id, days, true)}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
