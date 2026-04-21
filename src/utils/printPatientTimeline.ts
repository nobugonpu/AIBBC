interface Patient {
  patient_name: string;
  start_date: string;
  cycles_planned: number;
  cycles_completed: number;
}

interface Cycle {
  cycle_number: number;
  admission_date: string;
  scheduled_date: string;
  discharge_date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

interface TreatmentInfo {
  name: string;
  stayDays: number;
  intervalDays: number;
  color: string;
}

export function printPatientTimeline(patient: Patient, cycles: Cycle[], info: TreatmentInfo) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${patient.patient_name} 治療スケジュール</title>
        <style>
          body {
            font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
            padding: 40px;
            color: #1f2937;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 10px;
            color: #111827;
            border-bottom: 3px solid ${info.color === 'blue' ? '#3b82f6' : '#10b981'};
            padding-bottom: 10px;
          }
          .patient-info {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border-left: 4px solid ${info.color === 'blue' ? '#3b82f6' : '#10b981'};
          }
          .patient-info div {
            margin-bottom: 8px;
            font-size: 14px;
          }
          .patient-info strong {
            display: inline-block;
            width: 120px;
            color: #374151;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th {
            background: ${info.color === 'blue' ? '#dbeafe' : '#d1fae5'};
            color: ${info.color === 'blue' ? '#1e40af' : '#065f46'};
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border: 1px solid ${info.color === 'blue' ? '#bfdbfe' : '#a7f3d0'};
            font-size: 13px;
          }
          td {
            padding: 10px 12px;
            border: 1px solid #e5e7eb;
            font-size: 13px;
          }
          tr:nth-child(even) {
            background: #f9fafb;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
          }
          .status-scheduled {
            background: #dbeafe;
            color: #1e40af;
          }
          .status-completed {
            background: #d1fae5;
            color: #065f46;
          }
          .cycle-number {
            font-weight: 600;
            color: ${info.color === 'blue' ? '#2563eb' : '#059669'};
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
          }
          @media print {
            body {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <h1>${patient.patient_name} 様 治療スケジュール</h1>

        <div class="patient-info">
          <div><strong>治療タイプ:</strong> ${info.name}</div>
          <div><strong>開始日:</strong> ${new Date(patient.start_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div><strong>予定サイクル数:</strong> ${patient.cycles_planned}回</div>
          <div><strong>完了サイクル数:</strong> ${patient.cycles_completed}回</div>
          <div><strong>入院日数:</strong> ${info.stayDays}日間（入院日含む）</div>
          <div><strong>サイクル間隔:</strong> ${info.intervalDays}日</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 15%;">サイクル</th>
              <th style="width: 25%;">入院日</th>
              <th style="width: 25%;">治療日</th>
              <th style="width: 25%;">退院日</th>
              <th style="width: 10%;">ステータス</th>
            </tr>
          </thead>
          <tbody>
            ${cycles.map(cycle => {
              const admissionDate = new Date(cycle.admission_date);
              const treatmentDate = new Date(cycle.scheduled_date);
              const dischargeDate = new Date(cycle.discharge_date);

              return `
              <tr>
                <td class="cycle-number">第${cycle.cycle_number}サイクル</td>
                <td>${admissionDate.getFullYear()}/${String(admissionDate.getMonth() + 1).padStart(2, '0')}/${String(admissionDate.getDate()).padStart(2, '0')} (${['日', '月', '火', '水', '木', '金', '土'][admissionDate.getDay()]})</td>
                <td>${treatmentDate.getFullYear()}/${String(treatmentDate.getMonth() + 1).padStart(2, '0')}/${String(treatmentDate.getDate()).padStart(2, '0')} (${['日', '月', '火', '水', '木', '金', '土'][treatmentDate.getDay()]})</td>
                <td>${dischargeDate.getFullYear()}/${String(dischargeDate.getMonth() + 1).padStart(2, '0')}/${String(dischargeDate.getDate()).padStart(2, '0')} (${['日', '月', '火', '水', '木', '金', '土'][dischargeDate.getDay()]})</td>
                <td>
                  <span class="status-badge status-${cycle.status}">
                    ${cycle.status === 'scheduled' ? '予定' : cycle.status === 'completed' ? '完了' : 'キャンセル'}
                  </span>
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          印刷日: ${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
