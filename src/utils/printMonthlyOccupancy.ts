import type { Patient, Cycle, TreatmentInfoMap } from '../shared/contracts/patient';
import { printHtml } from './printHtml';

export function printMonthlyOccupancy(
  year: number,
  month: number,
  patients: Patient[],
  cycles: Cycle[],
  treatmentInfo: TreatmentInfoMap
) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const monthLabel = `${year}年${month}月`;

  // Collect all admission rows for this month
  interface Row {
    patientName: string;
    treatmentName: string;
    color: string;
    cycleNumber: number;
    admissionDate: string;
    treatmentDate: string;
    dischargeDate: string;
    status: string;
    notes: string;
  }

  const rows: Row[] = [];
  for (const cycle of cycles) {
    if (cycle.status === 'cancelled') continue;
    const admission = new Date(cycle.admission_date);
    const discharge = new Date(cycle.discharge_date);
    // Include if any part of stay overlaps with the month
    if (discharge < firstDay || admission > lastDay) continue;
    const patient = patients.find(p => p.id === cycle.patient_id);
    if (!patient) continue;
    const info = treatmentInfo[patient.treatment_type];
    rows.push({
      patientName: patient.patient_name,
      treatmentName: info.name,
      color: info.color,
      cycleNumber: cycle.cycle_number,
      admissionDate: cycle.admission_date,
      treatmentDate: cycle.scheduled_date,
      dischargeDate: cycle.discharge_date,
      status: cycle.status,
      notes: cycle.notes ?? '',
    });
  }

  rows.sort((a, b) => a.admissionDate.localeCompare(b.admissionDate));

  const fmtDate = (s: string) => {
    const d = new Date(s);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`;
  };

  const statusLabel = (s: string) => s === 'scheduled' ? '予定' : s === 'completed' ? '完了' : 'キャンセル';

  const rowsHtml = rows.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:20px;color:#6b7280;">この月の入院予定はありません</td></tr>`
    : rows.map(r => {
        const color = r.color === 'blue' ? '#2563eb' : '#059669';
        const bg = r.color === 'blue' ? '#eff6ff' : '#f0fdf4';
        return `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:8px 12px;font-weight:600;color:${color};">${r.patientName}</td>
          <td style="padding:8px 12px;font-size:12px;background:${bg};color:${color};">${r.treatmentName}<br>第${r.cycleNumber}サイクル</td>
          <td style="padding:8px 12px;font-size:13px;">${fmtDate(r.admissionDate)}</td>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;">${fmtDate(r.treatmentDate)}</td>
          <td style="padding:8px 12px;font-size:13px;">${fmtDate(r.dischargeDate)}</td>
          <td style="padding:8px 12px;">
            <span style="padding:3px 10px;border-radius:12px;font-size:11px;font-weight:500;
              background:${r.status === 'completed' ? '#d1fae5' : '#dbeafe'};
              color:${r.status === 'completed' ? '#065f46' : '#1e40af'};">
              ${statusLabel(r.status)}
            </span>
          </td>
          <td style="padding:8px 12px;font-size:12px;color:#6b7280;">${r.notes || '—'}</td>
        </tr>`;
      }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${monthLabel} 病室占有スケジュール</title>
  <style>
    body { font-family: 'Hiragino Sans','Meiryo',sans-serif; padding: 40px; color: #1f2937; }
    h1 { font-size: 22px; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; margin-bottom: 24px; }
    .summary { display: flex; gap: 20px; margin-bottom: 24px; }
    .summary-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 20px; font-size: 14px; }
    .summary-card strong { display: block; font-size: 24px; color: #1e40af; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #dbeafe; color: #1e40af; padding: 10px 12px; text-align: left; font-size: 13px; border: 1px solid #bfdbfe; }
    td { border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
    .footer { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>病室占有スケジュール — ${monthLabel}</h1>
  <div class="summary">
    <div class="summary-card">対象月<strong>${monthLabel}</strong></div>
    <div class="summary-card">入院件数<strong>${rows.length} 件</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>患者名</th>
        <th>治療種別 / サイクル</th>
        <th>入院日</th>
        <th>治療日（投与）</th>
        <th>退院日</th>
        <th>ステータス</th>
        <th>メモ</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">印刷日: ${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
</body>
</html>`;

  printHtml(html);
}
