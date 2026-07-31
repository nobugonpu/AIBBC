import { useState, useEffect, useMemo } from 'react';
import { Calendar, User, AlertCircle, CheckCircle, Printer, ArrowRight } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { canDeliverTreatment, getLutetiumAdmissionDate, getLutetiumDischargeDate, getLuPsmaAdmissionDate, getLuPsmaDischargeDate, formatDateToLocalString, areAllDatesBusinessDays } from '../utils/dateHelpers';
import { PatientForm } from './patient/PatientForm';
import { OccupancyStats } from './patient/OccupancyStats';
import { PatientList } from './patient/PatientList';
import type { CycleUpdatePayload } from './patient/PatientList';
import { UpcomingSchedule } from './patient/UpcomingSchedule';
import { OccupancyCalendar } from './patient/OccupancyCalendar';
import { OccupancyTimeline } from './patient/OccupancyTimeline';
import { printPatientTimeline } from '../utils/printPatientTimeline';
import { printPatientSchedule } from '../utils/printPatientSchedule';
import { printMonthlyOccupancy } from '../utils/printMonthlyOccupancy';
import type { Patient, Cycle, OccupiedSlot, TreatmentInfoMap } from '../shared/contracts/patient';

function PatientManager() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [newPatient, setNewPatient] = useState({
    name: '',
    treatmentType: 'lu-psma' as 'lu-psma' | 'lutetium',
    startDate: new Date().toISOString().split('T')[0],
    cyclesPlanned: 6
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [conflictSuggestion, setConflictSuggestion] = useState<{ date: string; cycles: number[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [occupancyView, setOccupancyView] = useState<'calendar' | 'timeline'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const TREATMENT_INFO: TreatmentInfoMap = {
    'lu-psma': {
      name: 'プルヴィクト（Lu-PSMA-617）',
      stayDays: 3,
      intervalDays: 42,
      maxCycles: 6,
      color: 'blue',
      deliveryDays: [1, 2, 3, 4, 5]
    },
    'lutetium': {
      name: 'ルタテラ',
      stayDays: 3,
      intervalDays: 56,
      maxCycles: 4,
      color: 'green',
      deliveryDays: [2, 4]
    }
  };

  useEffect(() => {
    loadPatients();
    loadCycles();
  }, []);

  const loadPatients = async () => {
    try {
      const data = await invoke<Patient[]>('get_patients');
      setPatients(data);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  const loadCycles = async () => {
    try {
      const data = await invoke<Cycle[]>('get_cycles');
      setCycles(data);
    } catch (error) {
      console.error('Error loading cycles:', error);
    }
  };

  const getWeekKey = (date: Date): string => {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const daysSinceStart = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber}`;
  };

  const hasLu177TreatmentInWeek = (date: Date, excludeCycleId?: string): boolean => {
    const weekKey = getWeekKey(date);

    for (const cycle of cycles) {
      if (cycle.status === 'cancelled') continue;
      if (excludeCycleId && cycle.id === excludeCycleId) continue;

      const cycleDate = new Date(cycle.scheduled_date);
      const cycleWeekKey = getWeekKey(cycleDate);

      if (cycleWeekKey === weekKey) {
        return true;
      }
    }

    return false;
  };

  const calculateCycles = (treatmentType: 'lu-psma' | 'lutetium', startDate: string, cyclesPlanned: number) => {
    const info = TREATMENT_INFO[treatmentType];
    const scheduledCycles: {
      cycleNumber: number;
      scheduledDate: string;
      admissionDate: string;
      dischargeDate: string;
    }[] = [];

    // Each cycle is placed near its ideal date: cycle 1 at the requested start,
    // each next one intervalDays after the previous. placeCycle keeps the shift
    // within 2 weeks and never uses a past date.
    let idealDate = new Date(startDate);

    for (let i = 0; i < cyclesPlanned; i++) {
      const placed = placeCycle(treatmentType, idealDate);
      if (!placed) break;

      scheduledCycles.push({
        cycleNumber: i + 1,
        scheduledDate: formatDateToLocalString(placed.treat),
        admissionDate: formatDateToLocalString(placed.admit),
        dischargeDate: formatDateToLocalString(placed.discharge),
      });

      // The next cycle's ideal date is intervalDays after this one.
      idealDate = new Date(placed.treat);
      idealDate.setDate(idealDate.getDate() + info.intervalDays);
    }

    return scheduledCycles;
  };

  const checkAvailability = (
    admissionDate: string,
    dischargeDate: string,
    excludeCycleId?: string,
  ): boolean => {
    const admission = new Date(admissionDate);
    const discharge = new Date(dischargeDate);

    for (const cycle of cycles) {
      if (cycle.status === 'cancelled') continue;
      if (excludeCycleId && cycle.id === excludeCycleId) continue;

      const existingAdmission = new Date(cycle.admission_date);
      const existingDischarge = new Date(cycle.discharge_date);

      // Two stays overlap iff admission <= otherDischarge AND discharge >= otherAdmission.
      if (admission <= existingDischarge && discharge >= existingAdmission) {
        return false;
      }
    }

    return true;
  };

  type Slot = { treat: Date; admit: Date; discharge: Date };

  // Auto-shifts are capped here: the schedule may slip by at most this many
  // days to dodge holidays / other patients' bookings. Beyond this we do NOT
  // keep pushing the date out (which would stretch the treatment interval);
  // instead the cycle stays near its ideal date and is flagged as a conflict
  // for a human to resolve.
  const MAX_SHIFT_DAYS = 14;

  const stayDatesFor = (treatmentType: 'lu-psma' | 'lutetium', treat: Date): Slot => {
    const admit = treatmentType === 'lutetium'
      ? getLutetiumAdmissionDate(treat)
      : getLuPsmaAdmissionDate(treat);
    const discharge = treatmentType === 'lutetium'
      ? getLutetiumDischargeDate(treat)
      : getLuPsmaDischargeDate(treat);
    return { treat: new Date(treat), admit, discharge };
  };

  const clampToToday = (date: Date): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today ? today : d;
  };

  // Nearest valid delivery day on/after max(fromDate, today), ignoring bed/week
  // conflicts — used to keep the treatment interval when no free slot exists.
  const nearestValidDay = (treatmentType: 'lu-psma' | 'lutetium', fromDate: Date): Slot | null => {
    const d = clampToToday(fromDate);
    for (let i = 0; i < 400; i++) {
      if (canDeliverTreatment(d, treatmentType)) {
        const s = stayDatesFor(treatmentType, d);
        if (areAllDatesBusinessDays(s.admit, s.treat, s.discharge)) return s;
      }
      d.setDate(d.getDate() + 1);
    }
    return null;
  };

  // Earliest fully-free slot within MAX_SHIFT_DAYS after max(fromDate, today):
  // valid delivery day, within the weekly Lu-177 cap, all business days, and a
  // free bed — excluding the given cycle. Returns null if the 2-week window is full.
  const freeSlotWithin = (
    treatmentType: 'lu-psma' | 'lutetium',
    fromDate: Date,
    excludeCycleId?: string,
  ): Slot | null => {
    const start = clampToToday(fromDate);
    const limit = new Date(start);
    limit.setDate(limit.getDate() + MAX_SHIFT_DAYS);

    const d = new Date(start);
    while (d <= limit) {
      if (canDeliverTreatment(d, treatmentType) && !hasLu177TreatmentInWeek(d, excludeCycleId)) {
        const s = stayDatesFor(treatmentType, d);
        if (
          areAllDatesBusinessDays(s.admit, s.treat, s.discharge) &&
          checkAvailability(formatDateToLocalString(s.admit), formatDateToLocalString(s.discharge), excludeCycleId)
        ) {
          return s;
        }
      }
      d.setDate(d.getDate() + 1);
    }
    return null;
  };

  // Places a cycle as close to its ideal date as possible. Prefers a free slot
  // within 2 weeks (first-come-first-served — existing bookings never move).
  // If the 2-week window is full, keeps the interval by snapping to the nearest
  // valid day even though it overlaps, and marks it conflicted for review.
  const placeCycle = (
    treatmentType: 'lu-psma' | 'lutetium',
    idealDate: Date,
    excludeCycleId?: string,
  ): (Slot & { conflicted: boolean }) | null => {
    const free = freeSlotWithin(treatmentType, idealDate, excludeCycleId);
    if (free) return { ...free, conflicted: false };
    const valid = nearestValidDay(treatmentType, idealDate);
    if (valid) return { ...valid, conflicted: true };
    return null;
  };

  const addPatient = async (overrideStartDate?: string) => {
    if (!newPatient.name.trim()) {
      setMessage({ type: 'error', text: '患者名を入力してください' });
      return;
    }

    const startDate = overrideStartDate ?? newPatient.startDate;
    setLoading(true);
    setConflictSuggestion(null);
    try {
      // Cycles are placed near their ideal dates (shift capped at 2 weeks),
      // never in the past. A cycle that can't find a free slot within 2 weeks
      // keeps its interval and is left overlapping for manual review.
      const scheduledCycles = calculateCycles(
        newPatient.treatmentType,
        startDate,
        newPatient.cyclesPlanned,
      );

      if (scheduledCycles.length === 0) {
        setMessage({ type: 'error', text: '空いている治療日が見つかりませんでした。開始日を変えてお試しください。' });
        return;
      }

      await invoke('add_patient', {
        patientName: newPatient.name,
        treatmentType: newPatient.treatmentType,
        startDate,
        cyclesPlanned: newPatient.cyclesPlanned,
        cycles: scheduledCycles,
      });

      // Report adjustments: shifted start, unplaced cycles, or residual overlaps
      // that need manual attention (couldn't fit within the 2-week window).
      const firstDate = scheduledCycles[0].scheduledDate;
      const adjusted = firstDate > startDate;
      const short = scheduledCycles.length < newPatient.cyclesPlanned;
      const conflictCount = scheduledCycles.filter(
        c => !checkAvailability(c.admissionDate, c.dischargeDate),
      ).length;

      if (conflictCount > 0) {
        setMessage({
          type: 'error',
          text: `患者を追加しましたが、空きがなく${conflictCount}件が他の患者と重複しています（赤色表示）。日程をご確認・調整してください。`,
        });
      } else if (short) {
        setMessage({ type: 'success', text: `患者を追加しました（空き状況により${scheduledCycles.length}回分のみ登録。残りは後で追加してください）` });
      } else if (adjusted) {
        setMessage({ type: 'success', text: `患者を追加しました（空き状況に合わせて開始日を ${new Date(firstDate).toLocaleDateString('ja-JP')} に調整しました）` });
      } else {
        setMessage({ type: 'success', text: '患者を追加しました' });
      }

      setNewPatient({
        name: '',
        treatmentType: 'lu-psma',
        startDate: formatDateToLocalString(new Date()),
        cyclesPlanned: 6,
      });

      await loadPatients();
      await loadCycles();
    } catch (error) {
      console.error('Error adding patient:', error);
      setMessage({ type: 'error', text: typeof error === 'string' ? error : '患者の追加に失敗しました' });
    } finally {
      setLoading(false);
    }
  };

  const applyConflictSuggestion = () => {
    if (!conflictSuggestion) return;
    setNewPatient(prev => ({ ...prev, startDate: conflictSuggestion.date }));
    addPatient(conflictSuggestion.date);
  };

  const recalculateSubsequentCycles = async (
    patientId: string,
    fromCycleNumber: number,
    newScheduledDate: string
  ): Promise<void> => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    const treatmentType = patient.treatment_type;
    const info = TREATMENT_INFO[treatmentType];

    const subsequentCycles = cycles
      .filter(c => c.patient_id === patientId && c.cycle_number > fromCycleNumber)
      .sort((a, b) => a.cycle_number - b.cycle_number);

    if (subsequentCycles.length === 0) return;

    let prevDate = new Date(newScheduledDate);

    for (const cycle of subsequentCycles) {
      if (cycle.status === 'cancelled') continue;

      // Ideal date is intervalDays after the previous cycle. placeCycle keeps
      // the shift within 2 weeks (excluding this cycle itself); if the window
      // is full it keeps the interval and leaves an overlap for manual review.
      const ideal = new Date(prevDate);
      ideal.setDate(ideal.getDate() + info.intervalDays);

      const placed = placeCycle(treatmentType, ideal, cycle.id);
      if (!placed) continue;

      await invoke<Cycle>('update_cycle', {
        id: cycle.id,
        update: {
          scheduledDate: formatDateToLocalString(placed.treat),
          admissionDate: formatDateToLocalString(placed.admit),
          dischargeDate: formatDateToLocalString(placed.discharge),
          status: cycle.status,
          notes: cycle.notes,
        }
      });

      prevDate = placed.treat;
    }

    await loadCycles();
    await loadPatients();
  };

  const updateCycle = async (id: string, update: CycleUpdatePayload, recalculate: boolean, allowOverlap = false) => {
    try {
      const original = cycles.find(c => c.id === id);

      // Block a manual edit that would overlap another patient's stay
      // (excluding this cycle itself). Cancelled cycles never occupy a bed.
      // allowOverlap is set by postpone, which already placed the cycle as
      // close as possible and may intentionally leave a flagged conflict.
      if (
        !allowOverlap &&
        update.status !== 'cancelled' &&
        !checkAvailability(update.admissionDate, update.dischargeDate, id)
      ) {
        setMessage({ type: 'error', text: 'その日程は他の患者と重複します。別の日を選んでください。' });
        throw new Error('overlap');
      }

      const updatedCycle = await invoke<Cycle>('update_cycle', { id, update });
      setCycles(prev => prev.map(c => c.id === id ? updatedCycle : c));

      if (recalculate && original && update.scheduledDate !== original.scheduled_date) {
        await recalculateSubsequentCycles(original.patient_id, original.cycle_number, update.scheduledDate);
        setMessage({ type: 'success', text: 'サイクルを更新し、後続サイクルを再計算しました' });
      } else {
        await loadPatients();
        setMessage({ type: 'success', text: 'サイクルを更新しました' });
      }
    } catch (error) {
      console.error('Error updating cycle:', error);
      setMessage({ type: 'error', text: 'サイクルの更新に失敗しました' });
      throw error;
    }
  };

  const postponeCycle = async (cycleId: string, days: number, recalculate: boolean) => {
    const cycle = cycles.find(c => c.id === cycleId);
    if (!cycle) return;
    const patient = patients.find(p => p.id === cycle.patient_id);
    if (!patient) return;
    const treatmentType = patient.treatment_type;

    // The requested +N days is the ideal date. placeCycle keeps any further
    // shift within 2 weeks; if that window is full it keeps the date near the
    // requested one and leaves a flagged overlap (allowOverlap) rather than
    // pushing the treatment far out.
    const ideal = new Date(cycle.scheduled_date);
    ideal.setDate(ideal.getDate() + days);

    const placed = placeCycle(treatmentType, ideal, cycleId);
    if (!placed) {
      setMessage({ type: 'error', text: '延期先の治療日が見つかりませんでした。' });
      return;
    }

    await updateCycle(cycleId, {
      scheduledDate: formatDateToLocalString(placed.treat),
      admissionDate: formatDateToLocalString(placed.admit),
      dischargeDate: formatDateToLocalString(placed.discharge),
      status: cycle.status,
      notes: cycle.notes,
    }, recalculate, true);

    if (placed.conflicted) {
      setMessage({ type: 'error', text: '延期しましたが、2週間以内に空きがなく他の患者と重複しています（赤色表示）。ご確認ください。' });
    }
  };

  const deletePatient = async (id: string) => {
    if (!confirm('この患者を削除してもよろしいですか？関連するすべてのサイクルも削除されます。')) return;

    try {
      await invoke('delete_patient', { id });
      setMessage({ type: 'success', text: '患者を削除しました' });
      await loadPatients();
      await loadCycles();
    } catch (error) {
      console.error('Error deleting patient:', error);
      setMessage({ type: 'error', text: '患者の削除に失敗しました' });
    }
  };

  const getOccupiedDates = (): OccupiedSlot[] => {
    const occupied: OccupiedSlot[] = [];

    cycles.forEach(cycle => {
      if (cycle.status === 'cancelled') return;

      const patient = patients.find(p => p.id === cycle.patient_id);
      if (!patient) return;

      const admission = new Date(cycle.admission_date);
      const discharge = new Date(cycle.discharge_date);
      const scheduledDate = new Date(cycle.scheduled_date);
      const treatmentInfo = TREATMENT_INFO[patient.treatment_type];

      const currentDate = new Date(admission);
      while (currentDate <= discharge) {
        const dateStr = formatDateToLocalString(currentDate);
        const scheduledDateStr = formatDateToLocalString(scheduledDate);
        const admissionDateStr = formatDateToLocalString(admission);
        const dischargeDateStr = formatDateToLocalString(discharge);

        occupied.push({
          date: dateStr,
          patientName: patient.patient_name,
          treatmentType: treatmentInfo.name,
          cycleNumber: cycle.cycle_number,
          isAdmission: dateStr === admissionDateStr,
          isDischarge: dateStr === dischargeDateStr,
          isTreatmentDay: dateStr === scheduledDateStr
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    return occupied.sort((a, b) => a.date.localeCompare(b.date));
  };

  const getTreatmentsForDate = (date: Date) => {
    const dateStr = formatDateToLocalString(date);
    return getOccupiedDates().filter(slot => slot.date === dateStr);
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePrintMonthly = () => {
    printMonthlyOccupancy(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      patients,
      cycles,
      TREATMENT_INFO
    );
  };

  const handlePrintPatient = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    const patientCycles = cycles.filter(c => c.patient_id === patientId).sort((a, b) =>
      new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    );

    const info = TREATMENT_INFO[patient.treatment_type];
    printPatientTimeline(patient, patientCycles, info);
  };

  const handlePrintPatientSchedule = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    const patientCycles = cycles.filter(c => c.patient_id === patientId).sort((a, b) =>
      new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    );

    const info = TREATMENT_INFO[patient.treatment_type];
    printPatientSchedule(patient, patientCycles, info);
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getOccupancyStats = () => {
    const now = new Date();
    const next30Days = new Date(now);
    next30Days.setDate(now.getDate() + 30);

    const occupiedDates = getOccupiedDates().filter(slot => {
      const date = new Date(slot.date);
      return date >= now && date <= next30Days;
    });

    const uniqueDates = new Set(occupiedDates.map(slot => slot.date));

    return {
      totalDays: 30,
      occupiedDays: uniqueDates.size,
      utilizationRate: ((uniqueDates.size / 30) * 100).toFixed(1)
    };
  };

  const stats = getOccupancyStats();
  const occupiedSlots = getOccupiedDates();

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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-8 h-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">患者管理</h2>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {conflictSuggestion && (
          <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-800 mb-3">
              他の患者と日程が重複しています。次に空いている開始日に自動でずらして追加できます：
              <span className="font-bold ml-1">
                {new Date(conflictSuggestion.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
              </span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={applyConflictSuggestion}
                disabled={loading}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                この日程で追加
              </button>
              <button
                onClick={() => setConflictSuggestion(null)}
                disabled={loading}
                className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                やめる
              </button>
            </div>
          </div>
        )}

        <OccupancyStats stats={stats} />
        <PatientForm
          newPatient={newPatient}
          setNewPatient={setNewPatient}
          onAdd={addPatient}
          loading={loading}
          treatmentInfo={TREATMENT_INFO}
          setMessage={setMessage}
        />
      </div>

      {occupiedSlots.length > 0 && (
        <UpcomingSchedule
          patients={patients}
          cycles={cycles}
          treatmentInfo={TREATMENT_INFO}
          conflictingCycleIds={conflictingCycleIds}
        />
      )}

      <PatientList
        patients={patients}
        cycles={cycles}
        treatmentInfo={TREATMENT_INFO}
        onDelete={deletePatient}
        onPrint={handlePrintPatient}
        onPrintForPatient={handlePrintPatientSchedule}
        onCycleUpdate={updateCycle}
        onCyclePostpone={postponeCycle}
      />

      {occupiedSlots.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              病室占有スケジュール
            </h3>
            <div className="flex gap-2 no-print">
              <button
                onClick={handlePrintMonthly}
                className="px-4 py-2 text-sm rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                月次帳票
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                印刷
              </button>
              <button
                onClick={() => setOccupancyView('calendar')}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  occupancyView === 'calendar'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                カレンダー表示
              </button>
              <button
                onClick={() => setOccupancyView('timeline')}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  occupancyView === 'timeline'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                タイムライン表示
              </button>
            </div>
          </div>

          {occupancyView === 'calendar' ? (
            <OccupancyCalendar
              currentMonth={currentMonth}
              onPreviousMonth={previousMonth}
              onNextMonth={nextMonth}
              getTreatmentsForDate={getTreatmentsForDate}
            />
          ) : (
            <OccupancyTimeline
              patients={patients}
              cycles={cycles}
              occupiedSlots={occupiedSlots}
              treatmentInfo={TREATMENT_INFO}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default PatientManager;
