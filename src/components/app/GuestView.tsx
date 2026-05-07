import { Calendar, Users } from 'lucide-react';
import TreatmentScheduler from '../TreatmentScheduler';
import PatientManager from '../PatientManager';

interface GuestViewProps {
  guestPage: 'treatment' | 'patients';
  onGuestPageChange: (page: 'treatment' | 'patients') => void;
  onShowAuth?: () => void;
}

export function GuestView({ guestPage, onGuestPageChange, onShowAuth }: GuestViewProps) {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {guestPage === 'treatment' ? '治療スケジューラ' : '患者管理'}
          </h1>
          <div className="flex items-center gap-3">
            <nav className="flex gap-2 bg-white border border-gray-300 rounded-lg p-1 shadow-sm">
              <button
                onClick={() => onGuestPageChange('treatment')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  guestPage === 'treatment'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Calendar className="h-4 w-4" />
                Treatment
              </button>
              <button
                onClick={() => onGuestPageChange('patients')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  guestPage === 'patients'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Users className="h-4 w-4" />
                Patients
              </button>
            </nav>
            {onShowAuth && (
              <button
                onClick={onShowAuth}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
              >
                ログイン
              </button>
            )}
          </div>
        </div>
        {guestPage === 'treatment' ? <TreatmentScheduler /> : <PatientManager />}
      </div>
    </div>
  );
}
