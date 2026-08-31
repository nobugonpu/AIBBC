import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, KeyRound, Users, UserPlus, Trash2, ShieldCheck } from 'lucide-react';

interface Props {
  onClose: () => void;
  onChanged?: (msg: string) => void;
}

interface SessionInfo {
  username: string;
  role: string;
}
interface UserInfo {
  username: string;
  role: string;
  created_at: string;
}

export function AccountModal({ onClose, onChanged }: Props) {
  const [me, setMe] = useState<SessionInfo | null>(null);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // change-my-password fields
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');

  // add-user fields (admin)
  const [nu, setNu] = useState('');
  const [np, setNp] = useState('');
  const [nrole, setNrole] = useState('user');

  const isAdmin = me?.role === 'admin';

  const loadUsers = () => {
    invoke<UserInfo[]>('list_users')
      .then(setUsers)
      .catch(() => {});
  };

  useEffect(() => {
    invoke<SessionInfo>('whoami')
      .then(info => {
        setMe(info);
        if (info.role === 'admin') loadUsers();
      })
      .catch(() => setError('利用者情報を取得できませんでした'));
  }, []);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (newPw.length < 8) return setError('新しいパスワードは8文字以上にしてください');
    if (newPw !== newPw2) return setError('新しいパスワードが一致しません');
    setBusy(true);
    try {
      await invoke('change_my_password', { currentPassword: curPw, newPassword: newPw });
      setCurPw(''); setNewPw(''); setNewPw2('');
      const m = 'パスワードを変更しました';
      setNotice(m);
      onChanged?.(m);
    } catch (e) {
      const msg = typeof e === 'string' ? e : String(e);
      setError(msg.includes('InvalidPassword') ? '現在のパスワードが違います' : msg);
    } finally {
      setBusy(false);
    }
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setNotice(null);
    if (!nu.trim()) return setError('利用者名を入力してください');
    if (np.length < 8) return setError('初期パスワードは8文字以上にしてください');
    setBusy(true);
    try {
      await invoke('add_user', { username: nu.trim(), password: np, role: nrole });
      setNu(''); setNp(''); setNrole('user');
      setNotice(`利用者「${nu.trim()}」を追加しました`);
      loadUsers();
    } catch (e) {
      setError(typeof e === 'string' ? e : String(e));
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (username: string) => {
    setError(null); setNotice(null);
    if (!confirm(`利用者「${username}」を削除しますか？`)) return;
    setBusy(true);
    try {
      await invoke('delete_user', { username });
      setNotice(`利用者「${username}」を削除しました`);
      loadUsers();
    } catch (e) {
      setError(typeof e === 'string' ? e : String(e));
    } finally {
      setBusy(false);
    }
  };

  const input =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            利用者・パスワード
          </h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {me && (
            <p className="text-sm text-gray-600">
              ログイン中：<b>{me.username}</b>
              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                {me.role === 'admin' ? '管理者' : '一般'}
              </span>
            </p>
          )}

          {notice && (
            <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">{notice}</div>
          )}
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">{error}</div>
          )}

          {/* Change my password */}
          <form onSubmit={changePassword} className="space-y-3">
            <h3 className="font-bold text-sm text-gray-800 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-600" /> 自分のパスワードを変更
            </h3>
            <input className={input} type="password" placeholder="現在のパスワード"
              value={curPw} onChange={e => setCurPw(e.target.value)} required />
            <input className={input} type="password" placeholder="新しいパスワード（8文字以上）"
              value={newPw} onChange={e => setNewPw(e.target.value)} required />
            <input className={input} type="password" placeholder="新しいパスワード（確認）"
              value={newPw2} onChange={e => setNewPw2(e.target.value)} required />
            <button type="submit" disabled={busy}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300">
              変更する
            </button>
          </form>

          {/* Admin: user management */}
          {isAdmin && (
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <h3 className="font-bold text-sm text-gray-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" /> 利用者の管理（管理者）
              </h3>

              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {users.map(u => (
                  <div key={u.username} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <b>{u.username}</b>
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {u.role === 'admin' ? '管理者' : '一般'}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">{u.created_at}</span>
                    </div>
                    {u.username !== me?.username && (
                      <button onClick={() => removeUser(u.username)} disabled={busy}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="削除">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="px-3 py-3 text-xs text-gray-400">利用者がいません。</div>
                )}
              </div>

              <form onSubmit={addUser} className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4" /> 利用者を追加
                </h4>
                <input className={input} type="text" placeholder="利用者名（氏名・ID）"
                  value={nu} onChange={e => setNu(e.target.value)} />
                <input className={input} type="password" placeholder="初期パスワード（8文字以上）"
                  value={np} onChange={e => setNp(e.target.value)} />
                <select className={input} value={nrole} onChange={e => setNrole(e.target.value)}>
                  <option value="user">一般</option>
                  <option value="admin">管理者</option>
                </select>
                <button type="submit" disabled={busy}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300">
                  追加する
                </button>
                <p className="text-xs text-gray-400">
                  ※ 追加した利用者には初期パスワードを伝え、初回ログイン後にご自身で変更してもらってください。
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
