import type { OccupiedSlot } from '../shared/contracts/patient';
import { isHoliday } from './holidays';
import { isWeekExcludedByHoliday } from './dateHelpers';
import { printHtml } from './printHtml';

/**
 * Prints the month's treatment schedule as a CALENDAR grid (A4 landscape),
 * matching the on-screen 病室占有カレンダー. Self-contained HTML so it prints
 * cleanly on its own, separate from the patient list.
 */
export function printMonthlyCalendar(
  year: number,
  month: number, // 1-12
  getTreatmentsForDate: (date: Date) => OccupiedSlot[]
) {
  const monthIndex = month - 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, monthIndex, 1).getDay(); // 0=Sun

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIndex, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const style = (slot: OccupiedSlot): { bg: string; border: string; ink: string; label: string } => {
    const isP = slot.treatmentType.includes('プルヴィクト');
    const label = slot.isAdmission ? '入院' : slot.isDischarge ? '退院' : slot.isTreatmentDay ? '治療' : '';
    if (isP) {
      if (slot.isAdmission) return { bg: '#fce7f3', border: '#db2777', ink: '#9d174d', label };
      if (slot.isDischarge) return { bg: '#f3e8ff', border: '#7c3aed', ink: '#5b21b6', label };
      return { bg: '#dbeafe', border: '#2563eb', ink: '#1e40af', label };
    } else {
      if (slot.isAdmission) return { bg: '#fef3c7', border: '#b45309', ink: '#92400e', label };
      if (slot.isDischarge) return { bg: '#e0e7ff', border: '#4f46e5', ink: '#3730a3', label };
      return { bg: '#d1fae5', border: '#059669', ink: '#065f46', label };
    }
  };

  const weekdayHeader = ['日', '月', '火', '水', '木', '金', '土']
    .map((d, i) => `<th class="dow ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${d}</th>`)
    .join('');

  let body = '';
  for (let w = 0; w < cells.length / 7; w++) {
    body += '<tr>';
    for (let i = 0; i < 7; i++) {
      const day = cells[w * 7 + i];
      if (!day) { body += '<td class="cell empty"></td>'; continue; }
      const weekend = day.getDay() === 0 || day.getDay() === 6;
      const hol = isHoliday(day);
      const excluded = !weekend && !hol && isWeekExcludedByHoliday(day);
      const treatments = getTreatmentsForDate(day);
      const items = treatments.map(t => {
        const s = style(t);
        return `<div class="ev" style="background:${s.bg};border-left:3px solid ${s.border};color:${s.ink};">
          <div class="ev-name">${escapeHtml(t.patientName)}</div>
          <div class="ev-sub">${escapeHtml(t.treatmentType)}${s.label ? ' (' + s.label + ')' : ''}・第${t.cycleNumber}回</div>
        </div>`;
      }).join('');
      const cellCls = 'cell' + (weekend || hol ? ' weekend' : '') + (excluded ? ' excluded' : '');
      const badges = (hol ? '<span class="badge hol">祝</span>' : '')
        + (excluded ? '<span class="badge exc">対象外</span>' : '');
      body += `<td class="${cellCls}"><div class="num ${day.getDay() === 0 ? 'sun' : day.getDay() === 6 ? 'sat' : ''}">${day.getDate()}${badges}</div><div class="evs">${items}</div></td>`;
    }
    body += '</tr>';
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${year}年${month}月 治療スケジュール</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: 'Hiragino Sans','Meiryo',sans-serif; color:#1f2937; margin:0; }
  h1 { font-size: 20px; text-align:center; margin: 0 0 12px; }
  table { width:100%; border-collapse:collapse; table-layout:fixed; }
  th.dow { background:#eff6ff; color:#1e40af; border:1px solid #cbd5e1; padding:6px 0; font-size:13px; }
  th.dow.sun { color:#dc2626; } th.dow.sat { color:#2563eb; }
  td.cell { border:1px solid #cbd5e1; vertical-align:top; height:96px; padding:3px 4px; overflow:hidden; }
  td.cell.empty { background:#f9fafb; }
  td.cell.weekend { background:#fafafa; }
  td.cell.excluded { background: repeating-linear-gradient(45deg,#f9fafb,#f9fafb 5px,#eef1f4 5px,#eef1f4 10px); }
  .num { font-size:12px; font-weight:700; margin-bottom:2px; }
  .num.sun { color:#dc2626; } .num.sat { color:#2563eb; }
  .badge { font-size:9px; font-weight:700; color:#fff; background:#dc2626; border-radius:3px; padding:0 4px; margin-left:3px; }
  .badge.exc { background:#9ca3af; }
  .ev { border-radius:4px; padding:2px 4px; margin-bottom:2px; }
  .ev-name { font-size:11px; font-weight:700; line-height:1.2; }
  .ev-sub { font-size:9px; line-height:1.2; }
  .legend { margin-top:10px; font-size:11px; display:flex; flex-wrap:wrap; gap:10px; }
  .legend .k { display:inline-flex; align-items:center; gap:4px; }
  .legend .sw { width:12px; height:12px; border-radius:3px; display:inline-block; }
  .footer { margin-top:10px; text-align:center; color:#9ca3af; font-size:11px; }
</style></head>
<body>
  <h1>${year}年 ${month}月 治療スケジュール（病室占有カレンダー）</h1>
  <table><thead><tr>${weekdayHeader}</tr></thead><tbody>${body}</tbody></table>
  <div class="legend">
    <span class="k"><span class="sw" style="background:#dbeafe;border:1px solid #2563eb"></span>プルヴィクト治療</span>
    <span class="k"><span class="sw" style="background:#fce7f3;border:1px solid #db2777"></span>プ入院</span>
    <span class="k"><span class="sw" style="background:#f3e8ff;border:1px solid #7c3aed"></span>プ退院</span>
    <span class="k"><span class="sw" style="background:#d1fae5;border:1px solid #059669"></span>ルタテラ治療</span>
    <span class="k"><span class="sw" style="background:#fef3c7;border:1px solid #b45309"></span>ル入院</span>
    <span class="k"><span class="sw" style="background:#e0e7ff;border:1px solid #4f46e5"></span>ル退院</span>
    <span class="k"><span class="sw" style="background:repeating-linear-gradient(45deg,#f9fafb,#f9fafb 3px,#eef1f4 3px,#eef1f4 6px);border:1px solid #cbd5e1"></span>治療対象外週（月・火・水が祝日）</span>
  </div>
  <div class="footer">印刷日: ${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
</body></html>`;

  printHtml(html);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
