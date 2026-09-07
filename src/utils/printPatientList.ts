import type { Patient, Cycle, TreatmentInfoMap } from '../shared/contracts/patient';
import { getOrderDeadline } from './dateHelpers';
import { printHtml } from './printHtml';

/**
 * Prints the registered-patient list (登録患者一覧) as a clean A4 table,
 * separate from the calendar. One row per patient: treatment type, progress,
 * start date, next treatment date and its drug-order deadline.
 */
export function printPatientList(
  patients: Patient[],
  cycles: Cycle[],
  treatmentInfo: TreatmentInfoMap
) {
  const fmt = (s: string) => {
    const d = new Date(s);
    if (isNaN(d.getTime())) return '—';
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}(${days[d.getDay()]})`;
  };
  const fmtDeadline = (treatmentDate: string) => {
    const d = new Date(treatmentDate);
    if (isNaN(d.getTime())) return '—';
    const dl = getOrderDeadline(d);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${dl.getMonth() + 1}/${dl.getDate()}(${days[dl.getDay()]}) 17時`;
  };

  const sorted = [...patients].sort((a, b) => a.start_date.localeCompare(b.start_date));

  const rows = sorted.map(p => {
    const info = treatmentInfo[p.treatment_type];
    const color = info?.color === 'blue' ? '#2563eb' : '#059669';
    const bg = info?.color === 'blue' ? '#eff6ff' : '#f0fdf4';
    const pc = cycles
      .filter(c => c.patient_id === p.id && c.status !== 'cancelled')
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
    // Next upcoming scheduled cycle (today or later); fall back to last cycle.
    const todayStr = new Date().toISOString().slice(0, 10);
    const next = pc.find(c => c.status === 'scheduled' && c.scheduled_date >= todayStr) || null;
    const nextInfo = next
      ? `第${next.cycle_number}回：${fmt(next.scheduled_date)}`
      : '—（予定なし）';
    const deadline = next ? fmtDeadline(next.scheduled_date) : '—';
    return `<tr>
      <td class="name" style="color:${color};">${escapeHtml(p.patient_name)}</td>
      <td><span class="pill" style="background:${bg};color:${color};">${escapeHtml(info?.name ?? p.treatment_type)}</span></td>
      <td class="center">${p.cycles_completed} / ${p.cycles_planned}</td>
      <td>${fmt(p.start_date)}</td>
      <td>${nextInfo}</td>
      <td>${deadline}</td>
    </tr>`;
  }).join('');

  const bodyRows = sorted.length === 0
    ? `<tr><td colspan="6" style="text-align:center;padding:20px;color:#6b7280;">登録患者はいません</td></tr>`
    : rows;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>登録患者一覧</title>
<style>
  @page { size: A4 portrait; margin: 15mm; }
  body { font-family: 'Hiragino Sans','Meiryo',sans-serif; color:#1f2937; margin:0; }
  h1 { font-size: 20px; border-bottom: 3px solid #3b82f6; padding-bottom: 8px; margin: 0 0 16px; }
  .meta { color:#6b7280; font-size:13px; margin-bottom:14px; }
  table { width:100%; border-collapse:collapse; }
  th { background:#dbeafe; color:#1e40af; border:1px solid #bfdbfe; padding:8px 10px; text-align:left; font-size:13px; white-space:nowrap; }
  td { border-bottom:1px solid #e5e7eb; padding:8px 10px; font-size:13px; vertical-align:middle; }
  td.name { font-weight:700; } td.center { text-align:center; }
  .pill { padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; }
  .footer { margin-top:28px; text-align:center; color:#9ca3af; font-size:12px; border-top:1px solid #e5e7eb; padding-top:14px; }
</style></head>
<body>
  <h1>登録患者一覧</h1>
  <div class="meta">登録患者数：${sorted.length} 名</div>
  <table>
    <thead><tr>
      <th>患者名</th><th>治療種別</th><th>進捗（完了/予定）</th><th>開始日</th><th>次回治療</th><th>次回 発注締切</th>
    </tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="footer">印刷日: ${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
</body></html>`;

  printHtml(html);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
