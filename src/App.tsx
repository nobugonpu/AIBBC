import { useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LocalAuth from './components/LocalAuth';
import Gallery from './components/Gallery';
import Home from './components/Home';
import TreatmentScheduler from './components/TreatmentScheduler';
import PatientManager from './components/PatientManager';
import { NavigationBar } from './components/app/NavigationBar';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { DataLocationModal } from './components/DataLocationModal';
import { CheckCircle, AlertCircle, Upload } from 'lucide-react';

type Page = 'home' | 'upload' | 'gallery' | 'treatment' | 'patients';

function MediaUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [desc, setDesc] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMsg(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const b64 = await fileToBase64(file);
      const ext = file.name.split('.').pop() ?? '';
      const mediaType = file.type.startsWith('video/') ? 'video' : 'photo';
      await invoke('save_media', {
        mediaType,
        fileBytesB64: b64,
        description: desc.trim(),
        fileExt: ext,
      });
      setMsg({ type: 'success', text: 'アップロードしました' });
      setFile(null);
      setPreview('');
      setDesc('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (e) {
      setMsg({ type: 'error', text: typeof e === 'string' ? e : 'アップロードに失敗しました' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-600" />
          メディアアップロード
        </h2>

        {msg && (
          <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
            msg.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {msg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {msg.text}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFile}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />

        {preview && (
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
            {file?.type.startsWith('video/') ? (
              <video src={preview} controls className="w-full h-full object-contain" />
            ) : (
              <img src={preview} alt="preview" className="w-full h-full object-contain" />
            )}
          </div>
        )}

        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="説明（任意）"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />暗号化して保存中...</>
          ) : (
            <><Upload className="w-4 h-4" />暗号化して保存</>
          )}
        </button>
        <p className="text-xs text-gray-400 text-center">
          ファイルはAES-256-GCMで暗号化し、アプリのデータフォルダ内に保存されます。アップロード後は元ファイルを削除しても問題ありません。
        </p>
      </div>
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AppContent() {
  const { unlocked, unlock, lock } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('treatment');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDataLocation, setShowDataLocation] = useState(false);

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
      case 'upload':    return <MediaUpload />;
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
