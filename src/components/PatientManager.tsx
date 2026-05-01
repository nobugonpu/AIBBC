import { useState, useEffect } from 'react';
import { Calendar, User, AlertCircle, CheckCircle, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { canDeliverTreatment, getNextDeliveryDay, getLutetiumAdmissionDate, getLutetiumDischargeDate, getLuPsmaAdmissionDate, getLuPsmaDischargeDate, formatDateToLocalString, areAllDatesBusinessDays } from '../utils/dateHelpers';
import { PatientForm } from './patient/PatientForm';
import { OccupancyStats } from './patient/OccupancyStats';
import { PatientList } from './patient/PatientList';
import { OccupancyCalendar } from './patient/OccupancyCalendar';
import { OccupancyTimeline } from './patient/OccupancyTimeline';
import { printPatientTimeline } from '../utils/printPatientTimeline';
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
  const [loading, setLoading] = useState(false);
  const [occupancyView, setOccupancyView] = useState<'calendar' | 'timeline'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const TREATMENT_INFO: TreatmentInfoMap = {
    'lu-psma': {
      name: 'プルヴィクト（Lu-PSMA-617）',
      stayDays: 4,
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
    if (!supabase) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('treatment_patients')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  const loadCycles = async () => {
    if (!supabase) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('treatment_cycles')
        .select('*')
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setCycles(data || []);
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
    let currentCycleDate = new Date(startDate);

    if (!canDeliverTreatment(currentCycleDate, treatmentType)) {
      currentCycleDate = getNextDeliveryDay(currentCycleDate, treatmentType);
    }

    const scheduledCycles = [];

    for (let i = 0; i < cyclesPlanned; i++) {
      let cycleDate = new Date(currentCycleDate);
      let attempts = 0;

      while (attempts < 365) {
        if (canDeliverTreatment(cycleDate, treatmentType)) {
          if (!hasLu177TreatmentInWeek(cycleDate)) {
            let admissionDate: Date;
            let dischargeDate: Date;

            if (treatmentType === 'lutetium') {
              admissionDate = getLutetiumAdmissionDate(cycleDate);
              dischargeDate = getLutetiumDischargeDate(cycleDate);
            } else {
              admissionDate = getLuPsmaAdmissionDate(cycleDate);
              dischargeDate = getLuPsmaDischargeDate(cycleDate);
            }

            if (areAllDatesBusinessDays(admissionDate, cycleDate, dischargeDate)) {
              break;
            }
          }
        }
        cycleDate.setDate(cycleDate.getDate() + 1);
        attempts++;
      }

      let admissionDate: Date;
      let dischargeDate: Date;

      if (treatmentType === 'lutetium') {
        admissionDate = getLutetiumAdmissionDate(cycleDate);
        dischargeDate = getLutetiumDischargeDate(cycleDate);
      } else {
        admissionDate = getLuPsmaAdmissionDate(cycleDate);
        dischargeDate = getLuPsmaDischargeDate(cycleDate);
      }

      scheduledCycles.push({
        cycleNumber: i + 1,
        scheduledDate: cycleDate.toISOString().split('T')[0],
        admissionDate: admissionDate.toISOString().split('T')[0],
        dischargeDate: dischargeDate.toISOString().split('T')[0]
      });

      let nextCycleDate = new Date(cycleDate);
      nextCycleDate.setDate(nextCycleDate.getDate() + info.intervalDays);

      while (!canDeliverTreatment(nextCycleDate, treatmentType)) {
        nextCycleDate.setDate(nextCycleDate.getDate() + 1);
      }

      currentCycleDate = nextCycleDate;
    }

    return scheduledCycles;
  };

  const checkAvailability = (admissionDate: string, dischargeDate: string): boolean => {
    const admission = new Date(admissionDate);
    const discharge = new Date(dischargeDate);

    for (const cycle of cycles) {
      if (cycle.status === 'cancelled') continue;

      const existingAdmission = new Date(cycle.admission_date);
      const existingDischarge = new Date(cycle.discharge_date);

      if (
        (admission >= existingAdmission && admission <= existingDischarge) ||
        (discharge >= existingAdmission && discharge <= existingDischarge) ||
        (admission <= existingAdmission && discharge >= existingDischarge)
      ) {
        return false;
      }
    }

    return true;
  };

  const findNextAvailableDate = (treatmentType: 'lu-psma' | 'lutetium', preferredDate: string): string => {
    let testDate = new Date(preferredDate);

    if (!canDeliverTreatment(testDate, treatmentType)) {
      testDate = getNextDeliveryDay(testDate, treatmentType);
    }

    let attempts = 0;
    const maxAttempts = 365;

    while (attempts < maxAttempts) {
      if (canDeliverTreatment(testDate, treatmentType) && !hasLu177TreatmentInWeek(testDate)) {
        let admissionDate: Date;
        let dischargeDate: Date;

        if (treatmentType === 'lutetium') {
          admissionDate = getLutetiumAdmissionDate(testDate);
          dischargeDate = getLutetiumDischargeDate(testDate);
        } else {
          admissionDate = getLuPsmaAdmissionDate(testDate);
          dischargeDate = getLuPsmaDischargeDate(testDate);
        }

        if (areAllDatesBusinessDays(admissionDate, testDate, dischargeDate) &&
            checkAvailability(admissionDate.toISOString().split('T')[0], dischargeDate.toISOString().split('T')[0])) {
          return testDate.toISOString().split('T')[0];
        }
      }

      testDate.setDate(testDate.getDate() + 1);
      attempts++;
    }

    return preferredDate;
  };

  const addPatient = async () => {
    if (!supabase) return;
    if (!newPatient.name.trim()) {
      setMessage({ type: 'error', text: '患者名を入力してください' });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const scheduledCycles = calculateCycles(
        newPatient.treatmentType,
        newPatient.startDate,
        newPatient.cyclesPlanned
      );

      const conflicts = [];
      for (const cycle of scheduledCycles) {
        if (!checkAvailability(cycle.admissionDate, cycle.dischargeDate)) {
          conflicts.push(cycle.cycleNumber);
        }
      }

      if (conflicts.length > 0) {
        const nextAvailable = findNextAvailableDate(newPatient.treatmentType, newPatient.startDate);
        setMessage({
          type: 'error',
          text: `サイクル${conflicts.join(', ')}が他の患者と重複しています。次に利用可能な開始日: ${new Date(nextAvailable).toLocaleDateString('ja-JP')}`
        });
        setLoading(false);
        return;
      }

      const { data: patientData, error: patientError } = await supabase
        .from('treatment_patients')
        .insert({
          user_id: user.id,
          patient_name: newPatient.name,
          treatment_type: newPatient.treatmentType,
          start_date: newPatient.startDate,
          cycles_planned: newPatient.cyclesPlanned,
          cycles_completed: 0
        })
        .select()
        .single();

      if (patientError) throw patientError;

      const cyclesData = scheduledCycles.map(cycle => ({
        patient_id: patientData.id,
        cycle_number: cycle.cycleNumber,
        scheduled_date: cycle.scheduledDate,
        admission_date: cycle.admissionDate,
        discharge_date: cycle.dischargeDate,
        status: 'scheduled'
      }));

      const { error: cyclesError } = await supabase
        .from('treatment_cycles')
        .insert(cyclesData);

      if (cyclesError) throw cyclesError;

      setMessage({ type: 'success', text: '患者を追加しました' });
      setNewPatient({
        name: '',
        treatmentType: 'lu-psma',
        startDate: new Date().toISOString().split('T')[0],
        cyclesPlanned: 6
      });

      await loadPatients();
      await loadCycles();
    } catch (error) {
      console.error('Error adding patient:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '患者の追加に失敗しました' });
    } finally {
      setLoading(false);
    }
  };

  const deletePatient = async (id: string) => {
    if (!confirm('この患者を削除してもよろしいですか？関連するすべてのサイクルも削除されます。')) return;

    try {
      const { error } = await supabase
        .from('treatment_patients')
        .delete()
        .eq('id', id);

      if (error) throw error;

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

  const handlePrintPatient = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    const patientCycles = cycles.filter(c => c.patient_id === patientId).sort((a, b) =>
      new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    );

    const info = TREATMENT_INFO[patient.treatment_type];
    printPatientTimeline(patient, patientCycles, info);
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

      <PatientList
        patients={patients}
        cycles={cycles}
        treatmentInfo={TREATMENT_INFO}
        onDelete={deletePatient}
        onPrint={handlePrintPatient}
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
