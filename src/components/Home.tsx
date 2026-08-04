import { Users, CalendarClock, CalendarDays, Images, ShieldCheck, FolderCog } from 'lucide-react';

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-600 to-emerald-600 rounded-2xl shadow-xl p-8 text-white">
        <h2 className="text-3xl font-bold mb-3">Lu-177治療患者スケジューラ</h2>
        <p className="text-blue-50 text-lg">
          プルヴィクト（Lu-PSMA-617）・ルタテラの入院治療スケジュールを、
          治療間隔・祝日・病床の重複を自動で考慮して管理します。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">患者管理</h3>
          <p className="text-gray-600 text-sm">
            患者を登録すると、治療間隔（Lu-PSMA 42日 / ルタテラ 56日）に沿って
            全サイクルの入院・治療・退院日を自動計算。重複は作らず、先に入れた予約は動かしません。
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
            <CalendarClock className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">治療スケジューラ</h3>
          <p className="text-gray-600 text-sm">
            期間・病床の空き状況から、Lu-PSMAとルタテラを何回ずつ行うのが最適かを
            シミュレーション。目的別に最適パターンを比較し、CSVで出力できます。
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
            <CalendarDays className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">病室占有カレンダー</h3>
          <p className="text-gray-600 text-sm">
            入院・治療・退院を色分けしたカレンダー／タイムラインで一覧。祝日や
            「月・火・水が祝日の週」の治療対象外も表示し、月次帳票を印刷できます。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Images className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">メディア管理</h3>
          </div>
          <p className="text-gray-600 text-sm">
            写真・動画を暗号化して保存。患者用の予定表もワンクリックで印刷できます。
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">データ暗号化</h3>
          </div>
          <p className="text-gray-600 text-sm">
            患者データ・メディアはパスワードで暗号化（AES-256 / SQLCipher）。
            ロック解除しない限り内容は読み取れません。
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <FolderCog className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">院内で共有</h3>
          </div>
          <p className="text-gray-600 text-sm">
            「保存先」を院内共有フォルダに設定すると、スタッフ全員が同じ
            患者スケジュールを共有できます（同時編集は避けてください）。
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800">
        <p className="font-semibold mb-1">はじめかた</p>
        <p>
          上部メニューの「患者管理（Patients）」から患者を登録すると、治療スケジュールが自動で作成されます。
          複数PCで共有する場合は「保存先」から院内共有フォルダを指定してください。
        </p>
      </div>
    </div>
  );
}
