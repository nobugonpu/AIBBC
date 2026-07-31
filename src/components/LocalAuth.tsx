import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Lock, KeyRound, Eye, EyeOff, FolderCog } from 'lucide-react';
import { DataLocationModal } from './DataLocationModal';

interface Props {
  onUnlocked: () => void;
}

export default function LocalAuth({ onUnlocked }: Props) {
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [showDataLocation, setShowDataLocation] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<boolean>('is_setup')
      .then(setIsSetup)
      .catch(() => setError('アプリの初期化に失敗しました'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isSetup && password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }
    if (!isSetup && password.length < 8) {
      setError('パスワードは8文字以上にしてください');
      return;
    }

    setLoading(true);
    try {
      if (isSetup) {
        await invoke('unlock', { password });
      } else {
        await invoke('setup_password', { password });
      }
      setPassword('');
      setConfirmPassword('');
      onUnlocked();
    } catch (e) {
      const msg = typeof e === 'string' ? e : String(e);
      setError(
        msg.includes('invalid password') || msg.includes('InvalidPassword')
          ? 'パスワードが違います'
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  if (isSetup === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {isSetup ? (
                <Lock className="w-8 h-8 text-blue-600" />
              ) : (
                <KeyRound className="w-8 h-8 text-blue-600" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isSetup ? 'Lu-177治療患者スケジューラ' : '初回セットアップ'}
            </h1>
            <p className="text-gray-500 text-sm mt-2">
              {isSetup
                ? 'パスワードを入力してロックを解除してください'
                : 'データ暗号化に使用するパスワードを設定してください'}
            </p>
          </div>

          {/* Setup notice */}
          {!isSetup && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              このパスワードを忘れると患者データを復元できません。
              安全な場所に記録してください。
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isSetup ? 'パスワード' : '新しいパスワード（8文字以上）'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password (setup only) */}
            {!isSetup && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード（確認）
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isSetup ? '解錠中...' : 'セットアップ中...'}
                </>
              ) : isSetup ? (
                <>
                  <Lock className="w-5 h-5" />
                  解錠
                </>
              ) : (
                <>
                  <KeyRound className="w-5 h-5" />
                  セットアップ完了
                </>
              )}
            </button>
          </form>

          {/* Shared data folder — lets staff point at the shared folder
              before unlocking so everyone opens the same schedule. */}
          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={() => setShowDataLocation(true)}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
            >
              <FolderCog className="w-3.5 h-3.5" />
              データの保存先を変更（院内共有フォルダ）
            </button>
          </div>
        </div>
      </div>

      {showDataLocation && <DataLocationModal onClose={() => setShowDataLocation(false)} />}
    </div>
  );
}
