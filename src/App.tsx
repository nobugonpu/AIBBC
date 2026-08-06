import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LocalAuth from './components/LocalAuth';
import PatientManager from './components/PatientManager';
import { NavigationBar } from './components/app/NavigationBar';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { DataLocationModal } from './components/DataLocationModal';
import { CheckCircle, AlertCircle } from 'lucide-react';

function AppContent() {
  const { unlocked, unlock, lock } = useAuth();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDataLocation, setShowDataLocation] = useState(false);

  if (!unlocked) {
    return <LocalAuth onUnlocked={unlock} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">患者管理</h1>
          <NavigationBar
            onSignOut={lock}
            onChangePassword={() => setShowChangePassword(true)}
            onDataLocation={() => setShowDataLocation(true)}
          />
        </div>

        {showChangePassword && (
          <ChangePasswordModal
            onClose={() => setShowChangePassword(false)}
            onChanged={() => {
              setShowChangePassword(false);
              setMessage({ type: 'success', text: 'パスワードを変更しました' });
            }}
          />
        )}

        {showDataLocation && <DataLocationModal onClose={() => setShowDataLocation(false)} />}

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        <PatientManager />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
