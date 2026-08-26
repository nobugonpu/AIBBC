import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ScrollText, X, Download, RefreshCw } from 'lucide-react';

interface AuditEntry {
  id: number;
  at: string;
  operator: string;
  action: string;
  detail: string;
}

interface Props {
  onClose: () => void;
}

/** Colour hint per action so the log is easy to scan. */
function actionClass(action: string): string {
  if (action.includes('削除')) return 'bg-red-100 text-red-700';
  if (action.includes('追加')) return 'bg-green-100 text-green-700';
  if (action.includes('パスワード')) return 'bg-purple-100 text-purple-700';
  if (action.includes('変更')) return 'bg-amber-100 text-amber-700';
  if (action.includes('ロック')) return 'bg-gray-100 text-gray-600';
  return 'bg-blue-100 text-blue-700';
}

export function AuditLogModal({ onClose }: Props) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(null);
    invoke<AuditEntry[]>('get_audit_log', { limit: 500 })
      .then(setEntries)
      .catch(e => setError(typeof e === 'string' ? e : '操作履歴を取得できませんでした'));
  };

  useEffect(load, []);

  const exportCsv = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const path = await invoke<string | null>('export_audit_csv');
      if (path) setNotice(`保存しました：${path}`);
    } catch (e) {
      setError(typeof e === 'string' ? e : 'CSVの保存に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-blue-600" />
            操作履歴（監査ログ）
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-gray-100"
              title="再読み込み"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={exportCsv}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              CSVで保存
            </button>
            <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-3">
          <p className="text-xs text-gray-500">
            「誰が・いつ・何をしたか」を自動で記録しています。記録は変更・削除できません（追記のみ）。
          </p>
          {notice && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800 break-all">
              {notice}
            </div>
          )}
          {error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">{error}</div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-5">
          {entries === null ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">まだ記録がありません。</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 font-medium whitespace-nowrap">日時</th>
                  <th className="py-2 pr-3 font-medium whitespace-nowrap">利用者</th>
                  <th className="py-2 pr-3 font-medium whitespace-nowrap">操作</th>
                  <th className="py-2 font-medium">詳細</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-3 text-gray-600 whitespace-nowrap tabular-nums">{e.at}</td>
                    <td className="py-2 pr-3 text-gray-800 whitespace-nowrap">{e.operator || '—'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${actionClass(e.action)}`}>
                        {e.action}
                      </span>
                    </td>
                    <td className="py-2 text-gray-600">{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
          最新500件を表示しています。全件はCSVで保存できます。
        </div>
      </div>
    </div>
  );
}
