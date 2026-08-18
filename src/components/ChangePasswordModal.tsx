import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { KeyRound, X, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface Props {
  onClose: () => void;
  onChanged: () => void;
}

type Mode = 'loading' | 'admin-setup' | 'change-shared' | 'change-admin';

export function ChangePasswordModal({ onClose, onChanged }: Props) {
  const [mode, setMode] = useState<Mode>('loading');
  const [adminPassword, setAdminPassword] = useState('');
  const [currentAdmin, setCurrentAdmin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<boolean>('is_admin_set')
      .then(set => setMode(set ? 'change-shared' : 'admin-setup'))
      .catch(() => setError('状態の取得に失敗しました'));
  }, []);

  const reset = () => {
    setError(null); setAdminPassword(''); setCurrentAdmin(''); setNewPassword(''); setConfirmPassword('');
  };

  const errMsg = (e: unknown) => (typeof e === 'string' ? e : e instanceof Error ? e.message : String(e));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'admin-setup') {
      if (newPassword.length < 6) return setError('管理者パスワードは6文字以上にしてください');
      if (newPassword !== confirmPassword) return setError('管理者パスワードが一致しません');
      setLoading(true);
      try {
        await invoke('set_admin_password', { current: null, newPassword });
        onChanged();
      } catch (er) { setError(errMsg(er)); } finally { setLoading(false); }
      return;
    }

    if (mode === 'change-admin') {
      if (newPassword.length < 6) return setError('管理者パスワードは6文字以上にしてください');
      if (newPassword !== confirmPassword) return setError('新しい管理者パスワードが一致しません');
      setLoading(true);
      try {
        await invoke('set_admin_password', { current: currentAdmin, newPassword });
        onChanged();
      } catch (er) { setError(errMsg(er)); } finally { setLoading(false); }
      return;
    }

    // change-shared
    if (newPassword.length < 8) return setError('パスワードは8文字以上にしてください');
    if (newPassword !== confirmPassword) return setError('新しいパスワードが一致しません');
    setLoading(true);
    try {
      await invoke('change_password', { newPassword, adminPassword });
      onChanged();
    } catch (er) { setError(errMsg(er)); } finally { setLoading(false); }
  };

  const title =
    mode === 'admin-setup' ? '管理者パスワードの設定'
    : mode === 'change-admin' ? '管理者パスワードの変更'
    : '共有パスワードの変更';

  const input = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            {mode === 'change-shared' ? <KeyRound className="w-5 h-5 text-blue-600" /> : <ShieldCheck className="w-5 h-5 text-blue-600" />}
            {title}
          </h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode === 'admin-setup' && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            まず<b>管理者パスワード</b>を設定してください。以後、共有パスワードの変更にはこの管理者パスワードが必要になります（一般スタッフは変更できません）。
          </div>
        )}
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          パスワードを忘れると{mode === 'change-shared' ? '患者データを復元できません' : '管理者操作ができなくなります'}。安全な場所に記録してください。
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>
        )}

        {mode === 'loading' ? (
          <div className="py-6 text-center text-sm text-gray-500">読み込み中…</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'change-shared' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">管理者パスワード</label>
                <input type={show ? 'text' : 'password'} value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required autoFocus className={input} placeholder="••••••••" />
              </div>
            )}
            {mode === 'change-admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">現在の管理者パスワード</label>
                <input type={show ? 'text' : 'password'} value={currentAdmin} onChange={e => setCurrentAdmin(e.target.value)} required autoFocus className={input} placeholder="••••••••" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {mode === 'change-shared' ? '新しい共有パスワード（8文字以上）' : '新しい管理者パスワード（6文字以上）'}
              </label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} required className={input + ' pr-10'} placeholder="••••••••" />
                <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（確認）</label>
              <input type={show ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={input} placeholder="••••••••" />
            </div>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors">
                キャンセル
              </button>
              <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors">
                {loading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />処理中...</> : mode === 'admin-setup' ? '設定する' : '変更する'}
              </button>
            </div>

            {(mode === 'change-shared' || mode === 'change-admin') && (
              <div className="text-center pt-1">
                <button type="button" onClick={() => { reset(); setMode(mode === 'change-shared' ? 'change-admin' : 'change-shared'); }} className="text-xs text-gray-500 hover:text-blue-600">
                  {mode === 'change-shared' ? '管理者パスワードを変更する' : '共有パスワードの変更に戻る'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
