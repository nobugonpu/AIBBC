interface OccupancyStatsProps {
  stats: {
    totalDays: number;
    occupiedDays: number;
    utilizationRate: string;
  };
}

export function OccupancyStats({ stats }: OccupancyStatsProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <h3 className="font-semibold text-blue-900 mb-2">病室稼働状況（今後30日間）</h3>
      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
        <div>
          <div className="text-blue-600 font-medium">占有日数</div>
          <div className="text-2xl font-bold text-blue-900">{stats.occupiedDays}日</div>
        </div>
        <div>
          <div className="text-blue-600 font-medium">空き日数</div>
          <div className="text-2xl font-bold text-blue-900">{stats.totalDays - stats.occupiedDays}日</div>
        </div>
        <div>
          <div className="text-blue-600 font-medium">稼働率</div>
          <div className="text-2xl font-bold text-blue-900">{stats.utilizationRate}%</div>
        </div>
      </div>
      <div className="text-xs text-blue-700 border-t border-blue-200 pt-2 space-y-1">
        <div>※ 土日祝日を除く平日のみのスケジュールです</div>
        <div>※ プルヴィクト：月～金曜日納入可 / ルタテラ：火・木曜日のみ納入</div>
        <div>※ 祝翌日、お盆（8/11-15）、年末年始（12/29-1/3）は納入なし</div>
        <div className="font-semibold text-red-600">※ 週キャパ制約：1週間に最大1件のLu-177治療のみ可能</div>
        <div className="font-semibold text-red-600">※ 発注締切：治療日の週の2週間前の月曜17時（締切後の治療日は予約不可）</div>
        <div>※ 副作用による延期は最長16週（112日）まで可能（延期ボタン +4週/+8週）</div>
      </div>
    </div>
  );
}
