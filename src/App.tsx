import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LocalAuth from './components/LocalAuth';
import Gallery from './components/Gallery';
import Home from './components/Home';
import TreatmentScheduler from './components/TreatmentScheduler';
import PatientManager from './components/PatientManager';
import { NavigationBar } from './components/app/NavigationBar';
import { CheckCircle, AlertCircle, Construction } from 'lucide-react';

type Page = 'home' | 'upload' | 'gallery' | 'treatment' | 'patients';

function MediaPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-gray-400">
      <Construction className="w-16 h-16" />
      <p className="text-lg font-medium">メディア機能は Phase 2b Step 7 で実装予定です</p>
      <p className="text-sm">暗号化ローカルストレージへの移行作業中</p>
    </div>
  );
}

function AppContent() {
  const { unlocked, unlock, lock } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('treatment');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!unlocked) {
    return <LocalAuth onUnlocked={unlock} />;
  }

  const getPageTitle = (): string => {
    switch (currentPage) {
      case 'home':      return 'ホーム';
      case 'upload':    return 'メディアアップロード';
      case 'gallery':   return 'ギャラリー';
      case 'treatment': return '治療スケジューラ';
      case 'patients':  return '患者管理';
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':      return <Home />;
      case 'treatment': return <TreatmentScheduler />;
      case 'patients':  return <PatientManager />;
      case 'upload':    return <MediaPlaceholder />;
      case 'gallery':   return <Gallery />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{getPageTitle()}</h1>
          <NavigationBar
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onSignOut={lock}
          />
        </div>

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

        {renderPage()}
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
