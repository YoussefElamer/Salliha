import { AlarmClock, ChevronLeft, Download, Gauge, ListMusic, Pause, Play, Repeat, Repeat1, Search, SkipBack, SkipForward, Timer, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatArabicNumber, formatPlaybackTime, normalizeArabic } from '../core/arabic';
import { quranRepository } from '../quran/QuranRepository';
import { downloadRepository, type DownloadRecord } from '../downloads/DownloadRepository';
import type { RepeatMode } from '../core/types';
import { useAudio } from './AudioProvider';
import { filterReciters, reciters } from './reciters';

const repeatLabels: Record<RepeatMode, string> = {
  off: 'بدون تكرار',
  ayah: 'تكرار الآية',
  range: 'تكرار النطاق',
  surah: 'تكرار السورة'
};

/** المشغل الكامل: تحكم كامل، قائمة تشغيل، اختيار قارئ وسورة، مؤقت نوم، وتنزيل. */
export function PlayerSheet() {
  const audio = useAudio();
  const [tab, setTab] = useState<'player' | 'queue' | 'reciters'>('player');
  const [reciterQuery, setReciterQuery] = useState('');
  const [surahQuery, setSurahQuery] = useState('');
  const [downloadState, setDownloadState] = useState<DownloadRecord | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const surahs = quranRepository.getSurahs();

  const filteredReciters = useMemo(() => filterReciters(reciterQuery), [reciterQuery]);
  const filteredSurahs = useMemo(() => {
    const normalized = normalizeArabic(surahQuery);
    if (!normalized) return surahs.slice(0, 30);
    return surahs.filter((surah) => normalizeArabic(`${surah.name} ${surah.transliteration} ${surah.surahId}`).includes(normalized)).slice(0, 40);
  }, [surahQuery, surahs]);

  if (!audio.playerOpen) return null;
  const ayah = audio.currentAyah;
  const isSurahMode = audio.state.mode === 'surah' && audio.reciter.surahAudio;
  const progress = audio.duration > 0 ? Math.min(100, (audio.position / audio.duration) * 100) : 0;

  const cacheSurah = async () => {
    if (!ayah) return;
    setDownloadError('');
    try {
      const surah = quranRepository.getSurah(ayah.surahId);
      if (!surah) return;
      await downloadRepository.cacheSurah(audio.reciter, surah.verses, setDownloadState);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'تعذر تحميل التلاوة.');
    }
  };

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="مشغل التلاوة" onClick={audio.closePlayer}>
      <div className="player-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="section-heading">
          <h2>مشغل التلاوة</h2>
          <button className="icon-button" onClick={audio.closePlayer} aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>

        <div className="player-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'player'} className={tab === 'player' ? 'active' : ''} onClick={() => setTab('player')}>
            <Gauge size={16} /> التشغيل
          </button>
          <button role="tab" aria-selected={tab === 'queue'} className={tab === 'queue' ? 'active' : ''} onClick={() => setTab('queue')}>
            <ListMusic size={16} /> قائمة الانتظار
          </button>
          <button role="tab" aria-selected={tab === 'reciters'} className={tab === 'reciters' ? 'active' : ''} onClick={() => setTab('reciters')}>
            <Search size={16} /> القرّاء
          </button>
        </div>

        {tab === 'player' && (
          <>
            <div className="player-now">
              <span>{isSurahMode ? 'السورة كاملة' : 'الآية الحالية'}</span>
              <strong>{ayah ? `${ayah.surahName} — ${isSurahMode ? 'سورة' : formatArabicNumber(ayah.ayahNumber)}` : 'لم يبدأ التشغيل'}</strong>
              <small>{audio.reciter.name}</small>
            </div>

            {ayah && !isSurahMode && <p className="quran-snippet player-ayah-text">{ayah.text}</p>}

            <div className="seek-row">
              <input
                type="range"
                min={0}
                max={audio.duration || 0}
                step={0.5}
                value={audio.position}
                aria-label="شريط التقدم"
                onChange={(event) => audio.seek(Number(event.target.value))}
              />
              <div className="seek-times" dir="ltr">
                <span>{formatPlaybackTime(audio.position)}</span>
                <span>{formatPlaybackTime(audio.duration)}</span>
              </div>
            </div>

            <div className="player-controls roomy">
              <button onClick={() => audio.skip(-10)} aria-label="رجوع ١٠ ثوانٍ" className="icon-button">
                <Timer size={18} />
              </button>
              <button onClick={audio.previous} aria-label="السابق" className="icon-button">
                <SkipForward size={20} />
              </button>
              <button className="primary-icon large" onClick={audio.toggle} aria-label={audio.state.isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}>
                {audio.state.isPlaying ? <Pause size={26} /> : <Play size={26} />}
              </button>
              <button onClick={audio.next} aria-label="التالي" className="icon-button">
                <SkipBack size={20} />
              </button>
              <button onClick={() => audio.skip(10)} aria-label="تقدّم ١٠ ثوانٍ" className="icon-button">
                <AlarmClock size={18} />
              </button>
            </div>

            {ayah && !isSurahMode && (
              <div className="queue-nav">
                <button onClick={audio.previous} disabled={audio.state.currentIndex === 0}>
                  <ChevronLeft size={16} /> الآية السابقة
                </button>
                <span>
                  الآية {formatArabicNumber(audio.state.currentIndex + 1)} من {formatArabicNumber(audio.queue.length)}
                </span>
              </div>
            )}

            <div className="control-grid">
              <label>
                سرعة التلاوة
                <select value={audio.state.playbackRate} onChange={(event) => audio.setRate(Number(event.target.value))}>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <option key={rate} value={rate}>
                      {rate}×
                    </option>
                  ))}
                </select>
              </label>
              <label>
                جودة الصوت
                <select value={audio.bitrate} onChange={(event) => audio.setBitrate(Number(event.target.value))}>
                  <option value={128}>128 kbps — أعلى جودة</option>
                  <option value={64}>64 kbps — أقل استهلاكًا للبيانات</option>
                </select>
              </label>
              <label>
                التكرار
                <select value={audio.state.repeatMode} onChange={(event) => audio.setRepeatMode(event.target.value as RepeatMode)}>
                  {Object.entries(repeatLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                مؤقت النوم
                <select
                  value={audio.sleepRemainingSeconds !== null ? String(Math.ceil(audio.sleepRemainingSeconds / 60)) : 'off'}
                  onChange={(event) => audio.setSleepTimer(event.target.value === 'off' ? null : Number(event.target.value))}
                >
                  <option value="off">بدون</option>
                  {[5, 10, 15, 30, 60].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} دقيقة
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {audio.sleepRemainingSeconds !== null && <p className="state-note">سيتوقف التشغيل بعد {formatPlaybackTime(audio.sleepRemainingSeconds)}</p>}

            <div className="inline-actions">
              <button className="secondary-button" onClick={() => audio.setMode(isSurahMode ? 'ayah' : 'surah')}>
                {isSurahMode ? <Repeat size={18} /> : <Repeat1 size={18} />}
                {isSurahMode ? 'التبديل إلى آية بآية' : 'التبديل إلى السورة كاملة'}
              </button>
              <button className="secondary-button" onClick={cacheSurah}>
                <Download size={18} /> تحميل السورة للاستماع بدون إنترنت
              </button>
            </div>
            {downloadState && (
              <p className="state-note">
                {downloadState.status === 'complete' ? 'تم التحميل' : 'جارٍ التحميل'}: {formatArabicNumber(downloadState.downloadedAyat)}/{formatArabicNumber(downloadState.ayahCount)} — {(downloadState.bytes / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
            {downloadError && <p className="error-note">{downloadError}</p>}
            {audio.error && <p className="error-note">{audio.error}</p>}
          </>
        )}

        {tab === 'queue' && (
          <div className="queue-list">
            {!audio.queue.length && <p className="muted">لا توجد قائمة تشغيل. اختر سورة لبدء التشغيل.</p>}
            {ayah && (
              <label className="queue-surah-picker">
                تشغيل سورة
                <select
                  value={ayah.surahId}
                  onChange={(event) => audio.playSurah(Number(event.target.value), 1)}
                >
                  {surahs.map((surah) => (
                    <option key={surah.surahId} value={surah.surahId}>
                      {surah.surahId}. {surah.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {audio.queue.map((item, index) => (
              <button
                key={item.id}
                className={index === audio.state.currentIndex ? 'queue-item active' : 'queue-item'}
                onClick={() => audio.jumpTo(index)}
              >
                <span className="ayah-number">{formatArabicNumber(item.ayahNumber)}</span>
                <span className="queue-text">{item.text.slice(0, 90)}…</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'reciters' && (
          <>
            <div className="search-box">
              <Search size={18} />
              <input value={reciterQuery} onChange={(event) => setReciterQuery(event.target.value)} placeholder="ابحث عن قارئ..." />
            </div>
            <div className="reciter-list compact">
              {filteredReciters.map((reciter) => (
                <article key={reciter.id} className={audio.reciterId === reciter.id ? 'selected-reciter' : ''}>
                  <div>
                    <h3>{reciter.name}</h3>
                    <small>{reciter.country ? `${reciter.country} — ` : ''}{reciter.description}</small>
                  </div>
                  <button onClick={() => audio.setReciterId(reciter.id)}>{audio.reciterId === reciter.id ? 'قيد التشغيل' : 'اختيار'}</button>
                </article>
              ))}
              {!filteredReciters.length && <p className="muted">لا يوجد قارئ بهذا الاسم. عدد القرّاء المتاحين: {formatArabicNumber(reciters.length)}.</p>}
            </div>
            <label className="surah-search">
              تشغيل سورة
              <input value={surahQuery} onChange={(event) => setSurahQuery(event.target.value)} placeholder="ابحث باسم السورة..." />
            </label>
            <div className="surah-chips">
              {filteredSurahs.map((surah) => (
                <button key={surah.surahId} onClick={() => audio.playSurah(surah.surahId, 1)}>
                  {surah.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
