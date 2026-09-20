import { statsRepository } from './StatsRepository';
import { formatArabicNumber } from '../core/arabic';
import { useState, useEffect } from 'react';

export function StatsPage() {
  const [stats, setStats] = useState(() => statsRepository.getStats());
  useEffect(() => {
    const id = setInterval(() => setStats(statsRepository.getStats()), 2000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="page-grid">
      <section className="card full-span">
        <h1>الإحصائيات — محليًا فقط</h1>
        <p className="muted">كل الأرقام محفوظة على جهازك. لا إرسال لخادم ولا Leaderboards.</p>
      </section>
      <section className="card">
        <h2>القراءة</h2>
        <div className="stats-grid">
          <div><strong>{formatArabicNumber(stats.reading.totalBookmarks)}</strong><span>علامات</span></div>
          <div><strong>{stats.reading.lastPosition ? `${stats.reading.lastPosition.surahName} — ${stats.reading.lastPosition.ayahNumber}` : '—'}</strong><span>آخر موضع</span></div>
          <div><strong>{formatArabicNumber(stats.quran.totalSurahs)}</strong><span>سورة متاحة</span></div>
          <div><strong>{formatArabicNumber(stats.quran.totalAyahs)}</strong><span>آية متحقق منها</span></div>
        </div>
      </section>
      <section className="card">
        <h2>الحفظ</h2>
        <div className="stats-grid">
          <div><strong>{formatArabicNumber(stats.hifz.activePlans)}</strong><span>خطط نشطة</span></div>
          <div><strong>{formatArabicNumber(stats.hifz.streakDays)}</strong><span>سلسلة أيام</span></div>
          <div><strong>{formatArabicNumber(stats.hifz.totalMemorized)}</strong><span>آيات محفوظة</span></div>
          <div><strong>{formatArabicNumber(stats.hifz.dueReviews)}</strong><span>مراجعة مستحقة</span></div>
        </div>
      </section>
      <section className="card">
        <h2>الصلاة والأذكار</h2>
        <div className="stats-grid">
          <div><strong>{stats.prayer.nextPrayer}</strong><span>الصلاة القادمة</span></div>
          <div><strong>{stats.prayer.notificationsEnabled ? 'مفعّل' : 'متوقف'}</strong><span>التنبيهات</span></div>
          <div><strong>{formatArabicNumber(stats.adhkar.totalAdhkar)}</strong><span>ذكر متاح</span></div>
          <div><strong>{formatArabicNumber(stats.adhkar.countersUsed)}</strong><span>أذكار مستخدمة</span></div>
        </div>
      </section>
    </div>
  );
}
