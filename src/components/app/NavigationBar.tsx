import { LogOut, ShieldCheck, FolderCog, ScrollText } from 'lucide-react';

interface NavigationBarProps {
  onSignOut: () => void;
  onChangePassword: () => void;
  onDataLocation: () => void;
  onAuditLog: () => void;
}

export function NavigationBar({ onSignOut, onChangePassword, onDataLocation, onAuditLog }: NavigationBarProps) {
  const btn =
    'flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors shadow-sm';
  return (
    <div className="flex items-center gap-3">
      <button onClick={onAuditLog} className={btn} title="誰がいつ操作したかの記録（監査ログ）">
        <ScrollText className="h-4 w-4" />
        操作履歴
      </button>
      <button onClick={onDataLocation} className={btn} title="患者データの保存先（院内共有フォルダ）を設定">
        <FolderCog className="h-4 w-4" />
        保存先
      </button>
      <button onClick={onChangePassword} className={btn}>
        <ShieldCheck className="h-4 w-4" />
        利用者/パスワード
      </button>
      <button onClick={onSignOut} className={btn}>
        <LogOut className="h-4 w-4" />
        ロック
      </button>
    </div>
  );
}
