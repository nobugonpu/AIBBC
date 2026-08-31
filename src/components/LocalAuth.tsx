import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Lock, KeyRound, Eye, EyeOff, FolderCog, UserRound, RefreshCw } from 'lucide-react';
import { DataLocationModal } from './DataLocationModal';

interface Props {
  onUnlocked: () => void;
}

type Mode = 'loading' | 'login' | 'setup' | 'migrate';

export default function LocalAuth({ onUnlocked }: Props) {
  const [mode, setMode] = useState<Mode>('loading');
  const [showDataLocation, setShowDataLocation] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sharedPassword, setSharedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const setup = await invoke<boolean>('is_setup');
        if (setup) {
          setMode('login');
        } else {
          const migrate = await invoke<boolean>('needs_migration');
          setMode(migrate ? 'migrate' : 'setup');
        }
      } catch {
        setError('アプリの初期化に失敗しました');
        setMode('setup');
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('利用者名を入力してください');
      return;
    }
    if (mode !== 'login') {
      if (password.length < 8) {
        setError('パスワードは8文字以上にしてください');
        return;
      }
      if (password !== confirmPassword) {
        setError('パスワードが一致しません');
        return;
      }
    }

    setLoading(true);
    try {
      const u = username.trim();
      if (mode === 'login') {
        await invoke('login', { username: u, password });
      } else if (mode === 'setup') {
        await invoke('setup_first_user', { username: u, password });
      } else {
        await invoke('migrate_from_shared', {
          sharedPassword,
          adminUsername: u,
          adminPassword: password,
        });
      }
      setPassword('');
      setConfirmPassword('');
      setSharedPassword('');
      onUnlocked();
    } catch (e) {
      const msg = typeof e === 'string' ? e : String(e);
      setError(
        msg.includes('InvalidPassword') || msg.includes('invalid password')
          ? mode === 'migrate'
            ? '現在の共有パスワードが違います'
            : '利用者名またはパスワードが違います'
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const title =
    mode === 'login'
      ? 'Lu-177治療患者スケジューラ'
      : mode === 'setup'
        ? '初回セットアップ（管理者を作成）'
        : '個人アカウントへの移行';
  const subtitle =
    mode === 'login'
      ? '利用者名とパスワードでログインしてください'
      : mode === 'setup'
        ? '最初の管理者アカウントを作成します'
        : '共有パスワードを廃止し、個人アカウントに移行します';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {mode === 'login' ? (
                <Lock className="w-8 h-8 text-blue-600" />
              ) : mode === 'migrate' ? (
                <RefreshCw className="w-8 h-8 text-blue-600" />
              ) : (
                <KeyRound className="w-8 h-8 text-blue-600" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-gray-500 text-sm mt-2">{subtitle}</p>
          </div>

          {mode !== 'login' && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              このパスワードを忘れると、この利用者ではデータを開けなくなります。安全に管理してください。
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Migration: old shared password */}
            {mode === 'migrate' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  現在の共有パスワード
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={sharedPassword}
                  onChange={e => setSharedPassword(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="これまでの共通パスワード"
                />
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {mode === 'login' ? '利用者名' : '利用者名（あなたの氏名・ID）'}
              </label>
              <div className="relative">
                <UserRound className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoFocus={mode !== 'migrate'}
                  className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例：山田 太郎"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {mode === 'login' ? 'パスワード' : 'パスワード（8文字以上）'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
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

            {/* Confirm (setup / migrate) */}
            {mode !== 'login' && (
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
                  処理中...
                </>
              ) : mode === 'login' ? (
                <>
                  <Lock className="w-5 h-5" />
                  ログイン
                </>
              ) : mode === 'setup' ? (
                <>
                  <KeyRound className="w-5 h-5" />
                  管理者を作成して開始
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  移行して開始
                </>
              )}
            </button>
          </form>

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
