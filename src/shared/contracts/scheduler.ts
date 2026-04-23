import type { TreatmentType } from './patient';

export interface TreatmentEvent {
  type: TreatmentType;
  startDay: number;
  endDay: number;
  cycleNumber: number;
  weekNumber: number;
}

export interface OptimalPattern {
  luPsmaCount: number;
  lutetiumCount: number;
  totalDaysUsed: number;
  unusedDays: number;
  totalTreatments: number;
  schedule: TreatmentEvent[];
  isValid: boolean;
  weeklyCapacitySatisfied: boolean;
  minPatientsLuPsma: number;
  minPatientsLutetium: number;
  score: number;
}

export interface SavedSchedule {
  id: string;
  schedule_name: string;
  total_days_available: number;
  period_days: number;
  lu_psma_count: number;
  lutetium_count: number;
  total_days_used: number;
  schedule_data: TreatmentEvent[];
  created_at: string;
}

export type OptimizationObjective =
  | 'maximize_total'
  | 'maximize_lupsma'
  | 'minimize_unused'
  | 'exact_capacity';
