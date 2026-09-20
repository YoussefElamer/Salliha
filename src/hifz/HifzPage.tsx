import { useState } from 'react';
import { hifzRepository } from './HifzRepository';
import { quranRepository } from '../quran/QuranRepository';
import { formatArabicNumber } from '../core/arabic';

export function HifzPage() {
  const [refresh, setRefresh] = useState(0);
  const plans = hifzRepository.listPlans();
  const stats = hifzRepository.getStats();
  const [surahId, setSurahId] = useState(1);
  const [fromAyah, setFromAyah] = useState(1);
  const [toAyah, setToAyah] = useState(7);
  const [dailyGoal, setDailyGoal] = useState(3);
  const [title, setTitle] = useState('');
  const surahs = quranRepository.getSurahs();

  const create = () => {
    try {
      hifzRepository.createPlan({ title: title || `حفظ سورة ${quranRepository.getSurah(surahId)?.name}`, surahId, fromAyah: Number(fromAyah), toAyah: Number(toAyah), dailyGoal: Number(dailyGoal) });
      setRefresh((v) => v + 1);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'تعذر إنشاء الخطة');
    }
  };

  return (
    <div className="page-grid" key={refresh}>
      <section className="card full-span">
        <h1>الحفظ والمراجعة</h1>
        <p className="muted">نظام حفظ محلي فقط — لا يُرسل بياناتك. المراجعة بطابور مبسط (آيات قبل 3 أيام).</p>
        <div className="stats-row">
          <span>الخطط النشطة: {formatArabicNumber(stats.activePlans)}</span>
          <span>سلسلة الأيام: {formatArabicNumber(stats.streakDays)}</span>
          <span>آيات محفوظة: {formatArabicNumber(stats.totalMemorized)}</span>
          <span>مراجعة مستحقة: {formatArabicNumber(stats.dueReviews)}</span>
        </div>
      </section>

      <section className="card">
        <h2>خطة حفظ جديدة</h2>
        <label>العنوان</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: سورة الملك" />
        <label>السورة</label><select value={surahId} onChange={(e) => setSurahId(Number(e.target.value))}>{surahs.map((s) => <option key={s.surahId} value={s.surahId}>{s.name}</option>)}</select>
        <label>من آية</label><input type="number" value={fromAyah} onChange={(e) => setFromAyah(Number(e.target.value))} />
        <label>إلى آية</label><input type="number" value={toAyah} onChange={(e) => setToAyah(Number(e.target.value))} />
        <label>هدف يومي (آيات)</label><input type="number" value={dailyGoal} onChange={(e) => setDailyGoal(Number(e.target.value))} min={1} max={20} />
        <button className="primary-button" onClick={create}>إنشاء الخطة</button>
      </section>

      <section className="card">
        <h2>خططي</h2>
        {plans.length === 0 && <p className="muted">لا توجد خطط بعد.</p>}
        {plans.map((plan) => (
          <div key={plan.id} className="list-row">
            <strong>{plan.title}</strong>
            <span>سورة {quranRepository.getSurah(plan.surahId)?.name} {plan.fromAyah}-{plan.toAyah} • هدف {plan.dailyGoal}</span>
            <div className="inline-actions">
              <button onClick={() => { hifzRepository.markProgress(plan.id, [{ surahId: plan.surahId, ayahNumber: plan.fromAyah }]); setRefresh((v) => v + 1); }}>تسجيل اليوم +1</button>
              <button onClick={() => { hifzRepository.updatePlan(plan.id, { status: plan.status === 'active' ? 'paused' : 'active' }); setRefresh((v) => v + 1); }}>{plan.status === 'active' ? 'إيقاف' : 'تفعيل'}</button>
              <button onClick={() => { hifzRepository.removePlan(plan.id); setRefresh((v) => v + 1); }}>حذف</button>
            </div>
          </div>
        ))}
        {hifzRepository.getDueReviews().length > 0 && (
          <div className="due-box">
            <h3>مراجعة مستحقة</h3>
            <ul>{hifzRepository.getDueReviews().slice(0, 10).map((d) => <li key={`${d.surahId}:${d.ayahNumber}`}>سورة {quranRepository.getSurah(d.surahId)?.name} — آية {d.ayahNumber} (آخر حفظ {d.lastDate})</li>)}</ul>
          </div>
        )}
      </section>
    </div>
  );
}
