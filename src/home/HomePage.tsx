import { BookOpen, Bookmark, Headphones, MapPin, Search, Sparkles, Target } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { AppRoute } from '../app/navigation';
import { formatClock, formatDuration } from '../core/arabic';
import { bookmarkRepository } from '../bookmarks/BookmarkRepository';
import { quranRepository } from '../quran/QuranRepository';
import { prayerRepository } from '../prayer/PrayerRepository';
import { getCityById } from '../prayer/cities';
import { useAudio } from '../audio/AudioProvider';

export function HomePage({ navigate }: { navigate: (route: AppRoute) => void }) {
  const [now, setNow] = useState(new Date());
  const audio = useAudio();
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const times = useMemo(() => prayerRepository.getTodayTimes(now), [now]);
  const nextPrayer = useMemo(() => prayerRepository.getNextPrayer(now), [now]);
  const settings = prayerRepository.getSettings();
  const city = getCityById(settings.cityId);
  const readingPosition = bookmarkRepository.getReadingPosition() ?? { surahId: 1, ayahNumber: 1, updatedAt: new Date().toISOString() };
  const lastAyah = quranRepository.getAyah(readingPosition.surahId, readingPosition.ayahNumber) ?? quranRepository.getAyah(1, 1)!;
  const surah = quranRepository.getSurah(readingPosition.surahId);
  const progress = surah ? Math.round((readingPosition.ayahNumber / surah.ayahCount) * 100) : 0;
  const ayahOfDay = quranRepository.getAyahByGlobalNumber(((Math.floor(now.getTime() / 86_400_000) % 6236) + 1));

  return (
    <div className="page-grid">
      <section className="hero-card" aria-labelledby="next-prayer-title">
        <div className="hero-topline"><MapPin size={18} /> {city.name}، {city.country}</div>
        <h1 id="next-prayer-title">الصلاة القادمة</h1>
        <div className="next-prayer-name">{nextPrayer.name}</div>
        <div className="countdown" aria-live="polite">{formatDuration(nextPrayer.time.getTime() - now.getTime())}</div>
        <p>متبقي على الصلاة — الوقت الحالي {formatClock(now)}</p>
        <button className="primary-button" onClick={() => navigate('prayer')}>إعداد المواقيت والتنبيهات</button>
      </section>

      <section className="card">
        <div className="section-heading"><h2>مواقيت اليوم</h2><span>{formatClock(now)}</span></div>
        <div className="prayer-times-list">
          {times.map((item) => (
            <div className={`prayer-time ${item.name === nextPrayer.name ? 'is-next' : ''}`} key={item.name}>
              <span>{item.name}</span>
              <strong>{formatClock(item.time)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card continue-card">
        <div className="section-heading"><h2>تابع القراءة</h2><span>{progress}%</span></div>
        <p className="muted">سورة {lastAyah.surahName} — الآية {lastAyah.ayahNumber}</p>
        <p className="quran-snippet">{lastAyah.text}</p>
        <div className="progress"><span style={{ width: `${progress}%` }} /></div>
        <button className="primary-button" onClick={() => navigate('quran')}>متابعة القراءة</button>
      </section>

      <section className="card quick-card">
        <h2>الوصول السريع</h2>
        <div className="quick-grid">
          <button onClick={() => navigate('quran')}><BookOpen /> المصحف</button>
          <button onClick={() => navigate('search')}><Search /> البحث</button>
          <button onClick={() => navigate('audio')}><Headphones /> التلاوة</button>
          <button onClick={() => navigate('adhkar')}><Sparkles /> الأذكار</button>
          <button onClick={() => navigate('space')}><Bookmark /> العلامات</button>
          <button onClick={() => navigate('audio')}><Target /> الحفظ</button>
        </div>
      </section>

      {ayahOfDay && (
        <section className="card ayah-day-card">
          <div className="section-heading"><h2>آية اليوم</h2><span>من قاعدة القرآن</span></div>
          <p className="quran-ayah">{ayahOfDay.text}</p>
          <p className="muted">سورة {ayahOfDay.surahName} — الآية {ayahOfDay.ayahNumber}</p>
          <div className="inline-actions">
            <button onClick={() => audio.playAyah(ayahOfDay)}>تشغيل</button>
            <button onClick={() => bookmarkRepository.add(ayahOfDay.surahId, ayahOfDay.ayahNumber, 'آية اليوم')}>حفظ علامة</button>
            <button onClick={() => navigate('quran')}>فتح في المصحف</button>
          </div>
        </section>
      )}
    </div>
  );
}
