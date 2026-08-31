import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LocalAuth from './components/LocalAuth';
import PatientManager from './components/PatientManager';
import { NavigationBar } from './components/app/NavigationBar';
import { AccountModal } from './components/AccountModal';
import { DataLocationModal } from './components/DataLocationModal';
import { AuditLogModal } from './components/AuditLogModal';
import { CheckCircle, AlertCircle } from 'lucide-react';

function AppContent() {
  const { unlocked, unlock, lock } = useAuth();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDataLocation, setShowDataLocation] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [me, setMe] = useState<{ username: string; role: string } | null>(null);

  useEffect(() => {
    if (!unlocked) {
      setMe(null);
      return;
    }
    invoke<{ username: string; role: string }>('whoami')
      .then(setMe)
      .catch(() => setMe(null));
  }, [unlocked]);

  if (!unlocked) {
    return <LocalAuth onUnlocked={unlock} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">患者管理</h1>
            {me && (
              <p className="text-sm text-gray-500 mt-1">
                ログイン中：<span className="font-medium text-gray-700">{me.username}</span>
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                  {me.role === 'admin' ? '管理者' : '一般'}
                </span>
              </p>
            )}
          </div>
          <NavigationBar
            onSignOut={lock}
            onChangePassword={() => setShowChangePassword(true)}
            onDataLocation={() => setShowDataLocation(true)}
            onAuditLog={() => setShowAuditLog(true)}
          />
        </div>

        {showChangePassword && (
          <AccountModal
            onClose={() => setShowChangePassword(false)}
            onChanged={text => setMessage({ type: 'success', text })}
          />
        )}

        {showDataLocation && <DataLocationModal onClose={() => setShowDataLocation(false)} />}

        {showAuditLog && <AuditLogModal onClose={() => setShowAuditLog(false)} />}

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
