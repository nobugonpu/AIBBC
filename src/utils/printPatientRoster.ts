import type { Patient, Cycle, TreatmentInfoMap } from '../shared/contracts/patient';
import { getOrderDeadline } from './dateHelpers';
import { printHtml } from './printHtml';

/**
 * 登録患者一覧（各患者の全サイクル入り）を1ページに収まるようコンパクト印刷する。
 * 画面表示には手を加えず、印刷専用の自己完結HTMLを生成して印刷する（A4縦）。
 */
export function printPatientRoster(
  patients: Patient[],
  cycles: Cycle[],
  treatmentInfo: TreatmentInfoMap
) {
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  const fmt = (s: string) => {
    const d = new Date(s);
    if (isNaN(d.getTime())) return '—';
    return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`;
  };
  const fmtDeadline = (s: string) => {
    const d = new Date(s);
    if (isNaN(d.getTime())) return '—';
    const dl = getOrderDeadline(d);
    return `${dl.getMonth() + 1}/${dl.getDate()}(${DOW[dl.getDay()]}) 17時`;
  };
  const statusLabel = (s: string) => (s === 'completed' ? '完了' : s === 'cancelled' ? 'キャンセル' : '予定');

  const sorted = [...patients].sort((a, b) => a.start_date.localeCompare(b.start_date));

  const blocks = sorted.map(p => {
    const info = treatmentInfo[p.treatment_type];
    const color = info?.color === 'blue' ? '#1d4ed8' : '#047857';
    const bg = info?.color === 'blue' ? '#eff6ff' : '#ecfdf5';
    const pc = cycles
      .filter(c => c.patient_id === p.id)
      .sort((a, b) => a.cycle_number - b.cycle_number);

    const cycleRows = pc.length === 0
      ? `<tr><td colspan="6" style="padding:4px;color:#9ca3af;">サイクル未登録</td></tr>`
      : pc.map(c => `
        <tr>
          <td class="c">第${c.cycle_number}</td>
          <td>${fmt(c.scheduled_date)}</td>
          <td>${fmt(c.admission_date)}</td>
          <td>${fmt(c.discharge_date)}</td>
          <td>${c.status === 'cancelled' ? '—' : fmtDeadline(c.scheduled_date)}</td>
          <td class="c">${statusLabel(c.status)}</td>
        </tr>`).join('');

    return `
    <div class="pt">
      <div class="pt-head" style="border-left:4px solid ${color};">
        <span class="pt-name">${escapeHtml(p.patient_name)}</span>
        <span class="pt-pill" style="background:${bg};color:${color};">${escapeHtml(info?.name ?? p.treatment_type)}</span>
        <span class="pt-meta">進捗 ${p.cycles_completed}/${p.cycles_planned}　開始 ${fmt(p.start_date)}</span>
      </div>
      <table class="cyc">
        <thead><tr><th>サイクル</th><th>治療日</th><th>入院</th><th>退院</th><th>発注締切</th><th>状態</th></tr></thead>
        <tbody>${cycleRows}</tbody>
      </table>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>登録患者一覧</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  body { font-family: 'Hiragino Sans','Meiryo',sans-serif; color:#1f2937; margin:0; }
  h1 { font-size: 18px; border-bottom: 2px solid #3b82f6; padding-bottom: 6px; margin: 0 0 4px; }
  .sub { color:#6b7280; font-size:11px; margin-bottom:8px; }
  .pt { margin-bottom: 8px; page-break-inside: avoid; }
  .pt-head { display:flex; align-items:center; gap:8px; padding:3px 8px; background:#f9fafb; }
  .pt-name { font-weight:700; font-size:13px; }
  .pt-pill { font-size:10px; font-weight:700; padding:1px 7px; border-radius:9px; }
  .pt-meta { font-size:10px; color:#6b7280; margin-left:auto; }
  table.cyc { width:100%; border-collapse:collapse; font-size:10.5px; }
  table.cyc th { background:#eef2f7; color:#374151; border:1px solid #e5e7eb; padding:2px 6px; text-align:left; font-weight:600; white-space:nowrap; }
  table.cyc td { border:1px solid #eef1f4; padding:2px 6px; white-space:nowrap; }
  table.cyc td.c { text-align:center; }
  .footer { margin-top: 10px; text-align:center; color:#9ca3af; font-size:10px; }
</style></head>
<body>
  <h1>登録患者一覧</h1>
  <div class="sub">登録患者数：${sorted.length} 名　／　印刷日: ${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  ${sorted.length === 0 ? '<p style="color:#6b7280;">登録患者はいません</p>' : blocks}
  <div class="footer">Lu-177治療患者スケジューラ</div>
</body></html>`;

  printHtml(html);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
