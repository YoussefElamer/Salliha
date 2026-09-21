import { BookOpen, Bookmark, CalendarDays, Clock3, Headphones, MapPin, Play, Search, Sparkles, Target } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { AppRoute, RouteParams } from '../app/navigation';
import { formatClock, formatHijriDate, formatPlaybackTime, formatArabicNumber } from '../core/arabic';
import { bookmarkRepository } from '../bookmarks/BookmarkRepository';
import { quranRepository } from '../quran/QuranRepository';
import { prayerRepository } from '../prayer/PrayerRepository';
import { formatRemaining } from '../prayer/prayerCalculations';
import { adhkarRepository } from '../adhkar/AdhkarRepository';
import { useAudio } from '../audio/AudioProvider';

export function HomePage({ navigate }: { navigate: (route: AppRoute, params?: RouteParams) => void }) {
  const [tick, setTick] = useState(() => new Date());
  const audio = useAudio();

  useEffect(() => {
    const timer = window.setInterval(() => setTick(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const minuteKey = Math.floor(tick.getTime() / 60_000);
  const location = useMemo(() => prayerRepository.getLocation(), [minuteKey]);
  const times = useMemo(() => prayerRepository.getTodayTimes(tick), [minuteKey, location]);
  const next = useMemo(() => prayerRepository.getNextPrayer(tick), [minuteKey, location]);
  const readingPosition = bookmarkRepository.getReadingPosition() ?? { surahId: 1, ayahNumber: 1 };
  const lastAyah = quranRepository.getAyah(readingPosition.surahId, readingPosition.ayahNumber) ?? quranRepository.getAyah(1, 1)!;
  const surah = quranRepository.getSurah(readingPosition.surahId);
  const progress = surah ? Math.round((readingPosition.ayahNumber / surah.ayahCount) * 100) : 0;
  const ayahOfDay = quranRepository.getAyahByGlobalNumber(((Math.floor(tick.getTime() / 86_400_000) % 6236) + 1));
  const dhikrCategory = adhkarRepository.getProgress().lastCategory || 'أذكار الصباح';
  const dhikrItems = adhkarRepository.list(dhikrCategory);
  const dhikrDone = adhkarRepository.getTodayCompletedCount(dhikrCategory);

  return (
    <div className="page-grid">
      <section className="hero-card" aria-labelledby="next-prayer-title">
        <div className="hero-topline">
          <MapPin size={18} /> {location.name} — {location.countryAr}
        </div>
        <h1 id="next-prayer-title">الصلاة القادمة</h1>
        <div className="next-prayer-name">{next.name}</div>
        <div className="countdown" aria-live="polite">{formatRemaining(next.time, tick)}</div>
        <p className="hero-sub">
          {formatClock(next.time, location.timezone)} بتوقيت {location.name} · <CalendarDays size={14} /> {formatHijriDate(tick, location.timezone)}
        </p>
        <div className="inline-actions">
          <button className="primary-button" onClick={() => navigate('prayer')}>
            <Clock3 size={18} /> كل المواقيت والإعدادات
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <h2>مواقيت اليوم</h2>
          <span className="muted">{formatClock(tick, location.timezone)}</span>
        </div>
        <div className="prayer-times-list">
          {times.map((item) => (
            <div className={`prayer-time ${item.name === next.name ? 'is-next' : ''} ${item.status === 'current' ? 'is-current' : ''}`} key={item.name}>
              <span>{item.name}</span>
              <strong dir="ltr">{formatClock(item.time, location.timezone)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card continue-card">
        <div className="section-heading">
          <h2>تابع القراءة</h2>
          <span>{formatArabicNumber(progress)}%</span>
        </div>
        <p className="muted">
          سورة {lastAyah.surahName} — الآية {formatArabicNumber(lastAyah.ayahNumber)}
        </p>
        <p className="quran-snippet">{lastAyah.text}</p>
        <div className="progress">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="inline-actions">
          <button className="primary-button" onClick={() => navigate('quran', { surahId: lastAyah.surahId, ayahNumber: lastAyah.ayahNumber })}>
            <BookOpen size={18} /> متابعة القراءة
          </button>
          <button className="secondary-button" onClick={() => audio.playAyah(lastAyah)}>
            <Play size={18} /> تشغيل
          </button>
        </div>
      </section>

      <section className="card quick-card">
        <h2>الوصول السريع</h2>
        <div className="quick-grid">
          <button onClick={() => navigate('quran')}><BookOpen /> المصحف</button>
          <button onClick={() => navigate('search')}><Search /> البحث في القرآن</button>
          <button onClick={() => navigate('audio')}><Headphones /> التلاوة والقرّاء</button>
          <button onClick={() => navigate('adhkar')}><Sparkles /> الأذكار</button>
          <button onClick={() => navigate('space')}><Bookmark /> العلامات</button>
          <button onClick={() => navigate('hifz')}><Target /> الحفظ</button>
        </div>
      </section>

      {audio.lastSnapshot && !audio.currentAyah && (
        <section className="card resume-card">
          <div className="section-heading">
            <h2>متابعة الاستماع</h2>
            <span className="muted">{audio.lastSnapshot.reciterId}</span>
          </div>
          <p className="muted">
            آخر موضع: سورة {quranRepository.getSurah(audio.lastSnapshot.surahId)?.name} — الآية {formatArabicNumber(audio.lastSnapshot.ayahNumber)} ({formatPlaybackTime(audio.lastSnapshot.positionSeconds)})
          </p>
          <button className="primary-button" onClick={audio.resumeFromSnapshot}>
            <Play size={18} /> استئناف التشغيل
          </button>
        </section>
      )}

      <section className="card">
        <div className="section-heading">
          <h2>وِرد الأذكار</h2>
          <span className="muted">{dhikrCategory}</span>
        </div>
        <p className="muted">
          أنجزت اليوم {formatArabicNumber(dhikrDone)} من {formatArabicNumber(dhikrItems.length)}
        </p>
        <div className="progress">
          <span style={{ width: `${dhikrItems.length ? Math.round((dhikrDone / dhikrItems.length) * 100) : 0}%` }} />
        </div>
        <button className="secondary-button" onClick={() => navigate('adhkar')}>
          <Sparkles size={18} /> افتح العدّاد
        </button>
      </section>

      {ayahOfDay && (
        <section className="card ayah-day-card full-span">
          <div className="section-heading">
            <h2>آية اليوم</h2>
            <span className="muted">من قاعدة القرآن المحلية</span>
          </div>
          <p className="quran-ayah">{ayahOfDay.text}</p>
          <p className="muted">
            سورة {ayahOfDay.surahName} — الآية {formatArabicNumber(ayahOfDay.ayahNumber)}
          </p>
          <div className="inline-actions">
            <button onClick={() => audio.playAyah(ayahOfDay)}><Headphones size={18} /> تشغيل</button>
            <button onClick={() => bookmarkRepository.add(ayahOfDay.surahId, ayahOfDay.ayahNumber, 'آية اليوم')}><Bookmark size={18} /> حفظ علامة</button>
            <button onClick={() => navigate('quran', { surahId: ayahOfDay.surahId, ayahNumber: ayahOfDay.ayahNumber })}><BookOpen size={18} /> فتح في المصحف</button>
          </div>
        </section>
      )}
    </div>
  );
}
