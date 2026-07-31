import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FolderCog, X, HardDrive, Network, AlertTriangle } from 'lucide-react';

interface DataLocation {
  path: string;
  isShared: boolean;
}

interface Props {
  onClose: () => void;
}

export function DataLocationModal({ onClose }: Props) {
  const [loc, setLoc] = useState<DataLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<DataLocation>('get_data_location')
      .then(setLoc)
      .catch(() => setError('現在の保存先を取得できませんでした'));
  }, []);

  const applyAndRestart = async (path: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await invoke('set_data_location', { path });
      // Restart so the new location takes effect (paths resolve at startup).
      await invoke('restart_app');
    } catch (e) {
      setError(typeof e === 'string' ? e : '保存先の変更に失敗しました');
      setBusy(false);
    }
  };

  const chooseShared = async () => {
    setError(null);
    try {
      const picked = await invoke<string | null>('pick_data_folder');
      if (picked) await applyAndRestart(picked);
    } catch (e) {
      setError(typeof e === 'string' ? e : 'フォルダ選択に失敗しました');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FolderCog className="w-5 h-5 text-blue-600" />
            データの保存先（共有設定）
          </h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current location */}
        <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            {loc?.isShared ? <Network className="w-4 h-4 text-blue-600" /> : <HardDrive className="w-4 h-4 text-gray-500" />}
            現在の保存先：{loc ? (loc.isShared ? '共有フォルダ' : 'このPC（共有なし）') : '確認中…'}
          </div>
          {loc && <div className="text-xs text-gray-500 break-all">{loc.path}</div>}
        </div>

        {/* Explanation */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1">
          <p>院内の共有フォルダを指定すると、<b>スタッフ全員が同じ患者スケジュールを共有</b>できます。</p>
          <p>各PCでこのアプリを入れ、<b>同じ共有フォルダ</b>を指定してください。</p>
        </div>

        {/* Caveats */}
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <div className="flex items-center gap-1.5 font-semibold mb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> 共有利用の注意
          </div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>ロック解除のパスワードは<b>全員で共通</b>になります（同じ暗号化データを開くため）。</li>
            <li>同時刻に複数人が編集すると、データが壊れる恐れがあります。編集は1人ずつ行ってください。</li>
            <li>患者データを共有フォルダに保存するため、<b>院内のセキュリティ規定をご確認</b>ください。</li>
            <li>共有フォルダは必ず定期バックアップしてください。</li>
          </ul>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>
        )}

        <div className="space-y-2">
          <button
            onClick={chooseShared}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
          >
            {busy ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />適用して再起動します…</>
            ) : (
              <><Network className="w-4 h-4" />共有フォルダを選択する</>
            )}
          </button>

          {loc?.isShared && (
            <button
              onClick={() => applyAndRestart(null)}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              <HardDrive className="w-4 h-4" />このPCの保存に戻す
            </button>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-400 text-center">
          保存先を変えると、設定を反映するためアプリが自動で再起動します。
        </p>
      </div>
    </div>
  );
}
