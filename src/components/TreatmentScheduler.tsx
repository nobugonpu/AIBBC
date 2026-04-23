import { useState, useEffect } from 'react';
import { Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SchedulerForm } from './treatment/SchedulerForm';
import { OptimalPatternResult } from './treatment/OptimalPatternResult';
import { SavedSchedulesList } from './treatment/SavedSchedulesList';
import type { TreatmentEvent, OptimalPattern, SavedSchedule, OptimizationObjective } from '../shared/contracts/scheduler';

function TreatmentScheduler() {
  const [totalDays, setTotalDays] = useState<string>('13');
  const [periodMonths, setPeriodMonths] = useState<string>('9');
  const [weeklyCapacity, setWeeklyCapacity] = useState<string>('1');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [objective, setObjective] = useState<OptimizationObjective>('maximize_total');
  const [allPatterns, setAllPatterns] = useState<OptimalPattern[]>([]);
  const [bestPattern, setBestPattern] = useState<OptimalPattern | null>(null);
  const [savedSchedules, setSavedSchedules] = useState<SavedSchedule[]>([]);
  const [scheduleName, setScheduleName] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAllPatterns, setShowAllPatterns] = useState(false);

  useEffect(() => {
    loadSavedSchedules();
  }, []);

  const loadSavedSchedules = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('treatment_schedules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedSchedules(data || []);
    } catch (error) {
      console.error('Error loading schedules:', error);
    }
  };

  const calculateOptimalPattern = () => {
    const availableDays = parseInt(totalDays);
    const months = parseInt(periodMonths);
    const maxWeeklyTreatments = parseInt(weeklyCapacity);

    if (isNaN(availableDays) || isNaN(months) || isNaN(maxWeeklyTreatments) ||
        availableDays <= 0 || months <= 0 || maxWeeklyTreatments <= 0) {
      setMessage({ type: 'error', text: '有効な数値を入力してください' });
      return;
    }

    const periodInDays = months * 30;
    const totalWeeks = Math.floor(periodInDays / 7);

    const luPsmaStay = 3;
    const luPsmaInterval = 42;
    const lutetiumStay = 2;
    const lutetiumInterval = 56;

    const maxLuPsmaCycles = 6;
    const maxLutetiumCycles = 4;

    const maxLuPsmaPerPatient = Math.min(Math.floor(periodInDays / luPsmaInterval) + 1, maxLuPsmaCycles);
    const maxLutetiumPerPatient = Math.min(Math.floor(periodInDays / lutetiumInterval) + 1, maxLutetiumCycles);

    const maxLuPsma = Math.floor(availableDays / luPsmaStay);
    const patterns: OptimalPattern[] = [];

    for (let luPsmaCount = 0; luPsmaCount <= maxLuPsma; luPsmaCount++) {
      const daysUsedByLuPsma = luPsmaCount * luPsmaStay;
      const remainingDays = availableDays - daysUsedByLuPsma;
      const lutetiumCount = Math.floor(remainingDays / lutetiumStay);

      if (lutetiumCount < 0) continue;

      const totalDaysUsed = daysUsedByLuPsma + (lutetiumCount * lutetiumStay);
      const unusedDays = availableDays - totalDaysUsed;
      const totalTreatments = luPsmaCount + lutetiumCount;

      const weeklyCapacitySatisfied = totalTreatments <= (totalWeeks * maxWeeklyTreatments);

      const schedule: TreatmentEvent[] = [];
      let weekIndex = 0;

      for (let i = 0; i < luPsmaCount; i++) {
        if (weekIndex >= totalWeeks) break;
        const startDay = weekIndex * 7;
        schedule.push({
          type: 'lu-psma',
          startDay,
          endDay: startDay + luPsmaStay - 1,
          cycleNumber: i + 1,
          weekNumber: weekIndex + 1
        });
        weekIndex++;
      }

      for (let i = 0; i < lutetiumCount; i++) {
        if (weekIndex >= totalWeeks) break;
        const startDay = weekIndex * 7;
        schedule.push({
          type: 'lutetium',
          startDay,
          endDay: startDay + lutetiumStay - 1,
          cycleNumber: i + 1,
          weekNumber: weekIndex + 1
        });
        weekIndex++;
      }

      const minPatientsLuPsma = luPsmaCount > 0 ? Math.ceil(luPsmaCount / maxLuPsmaPerPatient) : 0;
      const minPatientsLutetium = lutetiumCount > 0 ? Math.ceil(lutetiumCount / maxLutetiumPerPatient) : 0;

      let score = 0;
      switch (objective) {
        case 'maximize_total':
          score = totalTreatments * 1000 - unusedDays;
          break;
        case 'maximize_lupsma':
          score = luPsmaCount * 10000 + lutetiumCount * 100 - unusedDays;
          break;
        case 'minimize_unused':
          score = (availableDays - unusedDays) * 1000 + totalTreatments;
          break;
        case 'exact_capacity':
          score = unusedDays === 0 ? totalTreatments * 1000 : -unusedDays * 100;
          break;
      }

      patterns.push({
        luPsmaCount,
        lutetiumCount,
        totalDaysUsed,
        unusedDays,
        totalTreatments,
        schedule,
        isValid: totalDaysUsed <= availableDays && weeklyCapacitySatisfied,
        weeklyCapacitySatisfied,
        minPatientsLuPsma,
        minPatientsLutetium,
        score
      });
    }

    patterns.sort((a, b) => b.score - a.score);

    setAllPatterns(patterns);
    if (patterns.length > 0) {
      setBestPattern(patterns[0]);
      setMessage(null);
    } else {
      setMessage({ type: 'error', text: '有効なパターンが見つかりませんでした' });
    }
  };

  const saveSchedule = async () => {
    if (!bestPattern || !scheduleName.trim()) {
      setMessage({ type: 'error', text: 'スケジュール名を入力してください' });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const { error } = await supabase
        .from('treatment_schedules')
        .insert({
          user_id: user.id,
          schedule_name: scheduleName,
          total_days_available: parseInt(totalDays),
          period_days: parseInt(periodMonths) * 30,
          lu_psma_count: bestPattern.luPsmaCount,
          lutetium_count: bestPattern.lutetiumCount,
          total_days_used: bestPattern.totalDaysUsed,
          schedule_data: bestPattern.schedule
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'スケジュールを保存しました' });
      setScheduleName('');
      await loadSavedSchedules();
    } catch (error) {
      console.error('Error saving schedule:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'スケジュールの保存に失敗しました' });
    } finally {
      setLoading(false);
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm('このスケジュールを削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('treatment_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'スケジュールを削除しました' });
      await loadSavedSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      setMessage({ type: 'error', text: 'スケジュールの削除に失敗しました' });
    }
  };

  const loadSchedule = (schedule: SavedSchedule) => {
    setTotalDays(schedule.total_days_available.toString());
    setPeriodMonths(Math.round(schedule.period_days / 30).toString());
    setBestPattern({
      luPsmaCount: schedule.lu_psma_count,
      lutetiumCount: schedule.lutetium_count,
      totalDaysUsed: schedule.total_days_used,
      unusedDays: schedule.total_days_available - schedule.total_days_used,
      totalTreatments: schedule.lu_psma_count + schedule.lutetium_count,
      schedule: schedule.schedule_data,
      isValid: schedule.total_days_used <= schedule.total_days_available,
      weeklyCapacitySatisfied: true,
      minPatientsLuPsma: 0,
      minPatientsLutetium: 0,
      score: 0
    });
    setMessage({ type: 'success', text: 'スケジュールを読み込みました' });
  };

  const exportToCSV = () => {
    if (!bestPattern) return;

    const rows = [
      ['放射性医薬品治療スケジュール最適化レポート'],
      [''],
      ['=== 入力条件 ==='],
      ['期間（月）', periodMonths],
      ['使用可能日数（合計）', totalDays],
      ['週あたりLu-177最大件数', weeklyCapacity],
      ['期間開始日', startDate],
      ['最適化の目的', getObjectiveName(objective)],
      [''],
      ['=== 最適パターン ==='],
      ['Lu-PSMA-617投与回数', bestPattern.luPsmaCount],
      ['ルタテラ投与回数', bestPattern.lutetiumCount],
      ['総投与回数', bestPattern.totalTreatments],
      ['使用日数合計', bestPattern.totalDaysUsed],
      ['未使用日数', bestPattern.unusedDays],
      ['週キャパ充足', bestPattern.weeklyCapacitySatisfied ? '充足' : '不足'],
      [''],
      ['=== 必要最小患者数 ==='],
      ['Lu-PSMA-617', `${bestPattern.minPatientsLuPsma}名`],
      ['ルタテラ', `${bestPattern.minPatientsLutetium}名`],
      [''],
      ['=== 週次スケジュール ==='],
      ['週', '治療タイプ', 'サイクル', '開始日', '終了日', '入院日数', '開始日付', '終了日付']
    ];

    const start = new Date(startDate);
    bestPattern.schedule.forEach(event => {
      const treatmentName = event.type === 'lu-psma' ? 'Lu-PSMA-617' : 'ルタテラ';
      const duration = event.endDay - event.startDay + 1;

      const eventStartDate = new Date(start);
      eventStartDate.setDate(start.getDate() + event.startDay);
      const eventEndDate = new Date(start);
      eventEndDate.setDate(start.getDate() + event.endDay);

      rows.push([
        `第${event.weekNumber}週`,
        treatmentName,
        event.cycleNumber.toString(),
        `${event.startDay + 1}日目`,
        `${event.endDay + 1}日目`,
        `${duration}日`,
        eventStartDate.toLocaleDateString('ja-JP'),
        eventEndDate.toLocaleDateString('ja-JP')
      ]);
    });

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `治療スケジュール_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getObjectiveName = (obj: OptimizationObjective): string => {
    switch (obj) {
      case 'maximize_total': return '総投与回数を最大化';
      case 'maximize_lupsma': return 'Lu-PSMAをできるだけ多く';
      case 'minimize_unused': return '未使用日数を最小化';
      case 'exact_capacity': return '使用可能日数ぴったり充足';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-8 h-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">放射性医薬品治療スケジューラ</h2>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        <SchedulerForm
          totalDays={totalDays}
          periodMonths={periodMonths}
          weeklyCapacity={weeklyCapacity}
          startDate={startDate}
          objective={objective}
          onTotalDaysChange={setTotalDays}
          onPeriodMonthsChange={setPeriodMonths}
          onWeeklyCapacityChange={setWeeklyCapacity}
          onStartDateChange={setStartDate}
          onObjectiveChange={setObjective}
          onCalculate={calculateOptimalPattern}
        />
      </div>

      {bestPattern && (
        <OptimalPatternResult
          pattern={bestPattern}
          totalDays={totalDays}
          startDate={startDate}
          objectiveName={getObjectiveName(objective)}
          scheduleName={scheduleName}
          loading={loading}
          onScheduleNameChange={setScheduleName}
          onSave={saveSchedule}
          onExport={exportToCSV}
        />
      )}

      {allPatterns.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">全候補パターン</h3>
            <button
              onClick={() => setShowAllPatterns(!showAllPatterns)}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {showAllPatterns ? '非表示' : '表示'}
            </button>
          </div>

          {showAllPatterns && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Lu-PSMA</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">ルタテラ</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">総回数</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">使用日数</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">未使用</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">週キャパ</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">スコア</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allPatterns.map((pattern, index) => (
                    <tr
                      key={index}
                      className={index === 0 ? 'bg-green-100 font-semibold' : 'hover:bg-gray-50'}
                    >
                      <td className="px-3 py-2">{pattern.luPsmaCount}</td>
                      <td className="px-3 py-2">{pattern.lutetiumCount}</td>
                      <td className="px-3 py-2">{pattern.totalTreatments}</td>
                      <td className="px-3 py-2">{pattern.totalDaysUsed}</td>
                      <td className="px-3 py-2">{pattern.unusedDays}</td>
                      <td className="px-3 py-2">
                        {pattern.weeklyCapacitySatisfied ? '○' : '×'}
                      </td>
                      <td className="px-3 py-2">{pattern.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <SavedSchedulesList
        schedules={savedSchedules}
        onLoad={loadSchedule}
        onDelete={deleteSchedule}
      />
    </div>
  );
}

export default TreatmentScheduler;
