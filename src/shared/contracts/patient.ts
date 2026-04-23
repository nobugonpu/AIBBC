export type TreatmentType = 'lu-psma' | 'lutetium';
export type CycleStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Patient {
  id: string;
  patient_name: string;
  treatment_type: TreatmentType;
  start_date: string;
  cycles_planned: number;
  cycles_completed: number;
  created_at: string;
}

export interface Cycle {
  id: string;
  patient_id: string;
  cycle_number: number;
  scheduled_date: string;
  admission_date: string;
  discharge_date: string;
  status: CycleStatus;
}

export interface OccupiedSlot {
  date: string;
  patientName: string;
  treatmentType: string;
  cycleNumber: number;
  isAdmission?: boolean;
  isDischarge?: boolean;
  isTreatmentDay?: boolean;
}

export interface TreatmentInfo {
  name: string;
  stayDays: number;
  intervalDays: number;
  maxCycles: number;
  color: string;
  deliveryDays: number[];
}

export type TreatmentInfoMap = Record<TreatmentType, TreatmentInfo>;
