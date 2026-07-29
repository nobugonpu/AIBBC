import type { Patient, Cycle, TreatmentInfo } from '../shared/contracts/patient';
import { printHtml } from './printHtml';

/**
 * 患者さん本人がご自身の治療予定を把握するための、やさしい表現の予定表を印刷します。
 * スタッフ向けの詳細表（printPatientTimeline）とは別に、大きな文字・平易な言葉で、
 * 入院日・治療日・退院日と持ち物・注意事項をまとめます。
 */
export function printPatientSchedule(patient: Patient, cycles: Cycle[], info: TreatmentInfo) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const fmt = (s: string) => {
    const d = new Date(s);
    return {
      md: `${d.getMonth() + 1}月${d.getDate()}日`,
      dow: days[d.getDay()],
      full: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`,
    };
  };

  const accent = info.color === 'blue' ? '#2563eb' : '#059669';
  const accentBg = info.color === 'blue' ? '#eff4ff' : '#ecfdf5';

  // キャンセルは除外し、回番号順に並べる
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const visible = cycles
    .filter(c => c.status !== 'cancelled')
    .sort((a, b) => a.cycle_number - b.cycle_number);

  // 次に来院する回（今日以降で最初の「予定」）
  const nextId = visible.find(c => c.status === 'scheduled' && new Date(c.scheduled_date) >= today)?.id;

  const cards = visible.map(c => {
    const admit = fmt(c.admission_date);
    const treat = fmt(c.scheduled_date);
    const discharge = fmt(c.discharge_date);
    const done = c.status === 'completed';
    const isNext = c.id === nextId;

    return `
      <div class="card ${isNext ? 'next' : ''} ${done ? 'done' : ''}">
        <div class="card-head">
          <span class="cycle-no">第${c.cycle_number}回</span>
          ${isNext ? '<span class="badge-next">次回のご予定</span>' : ''}
          ${done ? '<span class="badge-done">終了しました</span>' : ''}
        </div>
        <div class="dates">
          <div class="date-block admit">
            <div class="date-label">ご入院</div>
            <div class="date-main">${admit.md}<span class="dow">（${admit.dow}）</span></div>
          </div>
          <div class="arrow">→</div>
          <div class="date-block treat">
            <div class="date-label">お薬の投与</div>
            <div class="date-main">${treat.md}<span class="dow">（${treat.dow}）</span></div>
          </div>
          <div class="arrow">→</div>
          <div class="date-block discharge">
            <div class="date-label">ご退院</div>
            <div class="date-main">${discharge.md}<span class="dow">（${discharge.dow}）</span></div>
          </div>
        </div>
        ${c.notes ? `<div class="note">メモ：${escapeHtml(c.notes)}</div>` : ''}
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(patient.patient_name)}様 治療予定表</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Hiragino Sans','Hiragino Kaku Gothic ProN','Meiryo',sans-serif;
      color: #1f2937; padding: 32px 40px; line-height: 1.6; margin: 0;
    }
    .header { border-bottom: 4px solid ${accent}; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 30px; margin: 0 0 6px; }
    .header .patient { font-size: 22px; font-weight: 700; }
    .header .patient small { font-size: 15px; font-weight: 400; color: #6b7280; margin-left: 8px; }
    .header .treatment { display: inline-block; margin-top: 10px; padding: 5px 16px; border-radius: 999px;
      background: ${accentBg}; color: ${accent}; font-weight: 700; font-size: 15px; }
    .intro { background: #f9fafb; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; font-size: 15px; }

    .card { border: 2px solid #e5e7eb; border-radius: 14px; padding: 18px 20px; margin-bottom: 16px; page-break-inside: avoid; }
    .card.next { border-color: ${accent}; background: ${accentBg}; }
    .card.done { opacity: 0.6; }
    .card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .cycle-no { font-size: 20px; font-weight: 800; color: ${accent}; }
    .badge-next { background: ${accent}; color: #fff; font-size: 13px; font-weight: 700; padding: 3px 12px; border-radius: 999px; }
    .badge-done { background: #d1d5db; color: #374151; font-size: 13px; font-weight: 700; padding: 3px 12px; border-radius: 999px; }

    .dates { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .date-block { flex: 1; text-align: center; padding: 10px 6px; border-radius: 10px; background: #fff; border: 1px solid #eef2f7; }
    .date-label { font-size: 14px; color: #6b7280; margin-bottom: 4px; font-weight: 600; }
    .date-main { font-size: 24px; font-weight: 800; color: #111827; }
    .date-main .dow { font-size: 15px; font-weight: 600; color: #6b7280; margin-left: 2px; }
    .date-block.admit { border-top: 4px solid #ec4899; }
    .date-block.treat { border-top: 4px solid ${accent}; }
    .date-block.discharge { border-top: 4px solid #8b5cf6; }
    .arrow { font-size: 22px; color: #9ca3af; flex: none; }
    .note { margin-top: 12px; font-size: 14px; color: #4b5563; background: #f9fafb; border-radius: 8px; padding: 8px 12px; }

    .footer-notes { margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 18px; }
    .footer-notes h2 { font-size: 17px; margin: 0 0 10px; color: ${accent}; }
    .footer-notes ul { margin: 0; padding-left: 22px; font-size: 15px; }
    .footer-notes li { margin-bottom: 6px; }
    .print-date { margin-top: 26px; text-align: right; color: #9ca3af; font-size: 13px; }

    @media print { body { padding: 16px 20px; } .card { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>治療のご予定</h1>
    <div class="patient">${escapeHtml(patient.patient_name)} 様</div>
    <div class="treatment">${escapeHtml(info.name)}</div>
  </div>

  <div class="intro">
    下記があなたの治療のご予定です。<b>ご入院・お薬の投与・ご退院</b>の日をご確認ください。
    ご都合が悪い場合や、ご不明な点がありましたら、遠慮なく担当スタッフにお知らせください。
  </div>

  ${cards || '<p style="text-align:center;color:#9ca3af;padding:30px;">現在、ご予定はありません。</p>'}

  <div class="footer-notes">
    <h2>ご来院にあたってのお願い</h2>
    <ul>
      <li>ご入院日は、時間に余裕をもってお越しください（詳しい時間は担当スタッフにご確認ください）。</li>
      <li>健康保険証・お薬手帳・現在服用中のお薬をお持ちください。</li>
      <li>体調の変化（発熱・かぜ症状など）がある場合は、事前にご連絡ください。</li>
      <li>予定は変更になることがあります。最新のご予定は担当スタッフにご確認ください。</li>
    </ul>
  </div>

  <div class="print-date">発行日：${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
</body>
</html>`;

  printHtml(html);
}

function escapeHtml(s: string): string {
  return (s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] as string));
}
