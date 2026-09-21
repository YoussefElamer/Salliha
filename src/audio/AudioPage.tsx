import { Download, ListMusic, Pause, Play, RotateCcw, Search, SkipBack, SkipForward, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatArabicNumber, formatPlaybackTime, normalizeArabic } from '../core/arabic';
import { quranRepository } from '../quran/QuranRepository';
import { downloadRepository, type DownloadRecord } from '../downloads/DownloadRepository';
import { useAudio } from './AudioProvider';
import { filterReciters, reciters } from './reciters';

export function AudioPage() {
  const audio = useAudio();
  const [reciterQuery, setReciterQuery] = useState('');
  const [surahQuery, setSurahQuery] = useState('');
  const [fromAyah, setFromAyah] = useState(1);
  const [toAyah, setToAyah] = useState(7);
  const [hiddenText, setHiddenText] = useState(false);
  const [downloads, setDownloads] = useState<DownloadRecord[]>(() => downloadRepository.list());
  const [downloadError, setDownloadError] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<DownloadRecord | null>(null);
  const surahs = quranRepository.getSurahs();
  const surah = audio.currentSurah ?? surahs[0];
  const filteredReciters = useMemo(() => filterReciters(reciterQuery), [reciterQuery]);
  const filteredSurahs = useMemo(() => {
    const normalized = normalizeArabic(surahQuery);
    if (!normalized) return surahs.slice(0, 24);
    return surahs.filter((item) => normalizeArabic(`${item.name} ${item.transliteration} ${item.surahId}`).includes(normalized)).slice(0, 40);
  }, [surahQuery, surahs]);

  useEffect(() => {
    setToAyah(surah.ayahCount);
    setFromAyah(1);
  }, [surah.surahId, surah.ayahCount]);

  const range = useMemo(
    () => surah.verses.slice(Math.max(0, fromAyah - 1), Math.min(surah.ayahCount, Math.max(fromAyah, toAyah))),
    [fromAyah, surah, toAyah]
  );

  const cacheSurah = async (surahId = surah.surahId) => {
    setDownloadError('');
    const target = quranRepository.getSurah(surahId);
    if (!target) return;
    try {
      await downloadRepository.cacheSurah(audio.reciter, target.verses, (record) => setDownloadProgress({ ...record }));
      setDownloads(downloadRepository.list());
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'تعذر تحميل التلاوة.');
    } finally {
      setDownloadProgress(null);
    }
  };

  const progressLabel = downloadProgress
    ? `${formatArabicNumber(downloadProgress.downloadedAyat)}/${formatArabicNumber(downloadProgress.ayahCount)} — ${(downloadProgress.bytes / 1024 / 1024).toFixed(2)} MB`
    : null;

  return (
    <div className="page-grid">
      <section className="card full-span audio-hero">
        <div>
          <span className="muted">يعمل الآن</span>
          <h1>{audio.currentAyah ? `${audio.currentAyah.surahName}${audio.state.mode === 'surah' && audio.reciter.surahAudio ? '' : ` — الآية ${formatArabicNumber(audio.currentAyah.ayahNumber)}`}` : 'لم يبدأ التشغيل'}</h1>
          <p className="muted">{audio.reciter.name} · {audio.reciter.description}</p>
        </div>
        <div className="player-controls">
          <button onClick={audio.previous} aria-label="السابق"><SkipForward /></button>
          <button className="primary-icon large" onClick={audio.toggle} aria-label={audio.state.isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}>
            {audio.state.isPlaying ? <Pause /> : <Play />}
          </button>
          <button onClick={audio.next} aria-label="التالي"><SkipBack /></button>
        </div>
        <div className="seek-row slim">
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
        <div className="inline-actions">
          <button className="primary-button" onClick={audio.openPlayer}><ListMusic size={18} /> فتح المشغل الكامل</button>
          <button className="secondary-button" onClick={() => audio.playSurah(surah.surahId, 1)}>تشغيل سورة {surah.name}</button>
        </div>
      </section>

      <section className="card">
        <h2>القرّاء ({formatArabicNumber(reciters.length)})</h2>
        <div className="search-box">
          <Search size={18} />
          <input value={reciterQuery} onChange={(event) => setReciterQuery(event.target.value)} placeholder="ابحث بالاسم أو الدولة..." />
        </div>
        <div className="reciter-list">
          {filteredReciters.map((reciter) => (
            <article key={reciter.id} className={audio.reciterId === reciter.id ? 'selected-reciter' : ''}>
              <h3>{reciter.name}</h3>
              <p className="muted">{reciter.country ? `${reciter.country} — ` : ''}{reciter.description}</p>
              <small>{reciter.licenseNote}</small>
              <button onClick={() => audio.setReciterId(reciter.id)}>{audio.reciterId === reciter.id ? 'القارئ الحالي' : 'اختيار هذا القارئ'}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>السور</h2>
        <div className="search-box">
          <Search size={18} />
          <input value={surahQuery} onChange={(event) => setSurahQuery(event.target.value)} placeholder="ابحث باسم السورة أو رقمها..." />
        </div>
        <div className="surah-chips">
          {filteredSurahs.map((item) => (
            <button key={item.surahId} className={item.surahId === surah.surahId ? 'active' : ''} onClick={() => audio.playSurah(item.surahId, 1)}>
              {item.name}
            </button>
          ))}
        </div>
        <div className="inline-actions">
          <button className="secondary-button" onClick={() => cacheSurah()}><Download /> تحميل {surah.name}</button>
          <button className="secondary-button" onClick={() => audio.playSurah(surah.surahId, 1)}><Play size={18} /> تشغيل {surah.name}</button>
        </div>
        {progressLabel && <p className="state-note">جارٍ التحميل: {progressLabel}</p>}
        {downloadError && <p className="error-note">{downloadError}</p>}
      </section>

      <section className="card">
        <h2>الحفظ والتكرار</h2>
        <p className="muted">حدد نطاق الآيات لتكراره — مناسب للمراجعة والحفظ. النطاق يعمل مع «تكرار النطاق» في المشغل.</p>
        <div className="range-grid">
          <label>من آية<input type="number" value={fromAyah} min={1} max={surah.ayahCount} onChange={(event) => setFromAyah(Number(event.target.value))} /></label>
          <label>إلى آية<input type="number" value={toAyah} min={fromAyah} max={surah.ayahCount} onChange={(event) => setToAyah(Number(event.target.value))} /></label>
        </div>
        <div className="inline-actions">
          <button
            className="primary-button"
            onClick={() => {
              if (!range.length) return;
              audio.playQueue(range, 0);
              audio.setRange({ surahId: surah.surahId, fromAyah, toAyah });
              audio.setRepeatMode('range');
            }}
          >
            <RotateCcw /> تشغيل وتكرار النطاق
          </button>
        </div>
        <label className="toggle-row">
          <span>اختبار الحفظ: إخفاء النص</span>
          <input type="checkbox" checked={hiddenText} onChange={(event) => setHiddenText(event.target.checked)} />
        </label>
        <div className={`memorization-text ${hiddenText ? 'hidden-text' : ''}`}>
          {range.map((ayah) => (
            <p key={ayah.id} onClick={() => audio.playAyah(ayah)}>
              {ayah.text} <span className="ayah-number">{formatArabicNumber(ayah.ayahNumber)}</span>
            </p>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>التلاوات المحفوظة على الجهاز</h2>
        {!downloads.length && <p className="muted">لا توجد تلاوات محفوظة بعد. اختر سورة واضغط «تحميل» للاستماع بدون إنترنت.</p>}
        <div className="download-list">
          {downloads.map((record) => (
            <div className="download-item" key={record.id}>
              <div>
                <strong>{quranRepository.getSurah(record.surahId)?.name ?? record.surahId}</strong>
                <small>{record.downloadedAyat}/{record.ayahCount} آية — {(record.bytes / 1024 / 1024).toFixed(2)} MB — {record.status === 'complete' ? 'مكتمل' : record.status === 'error' ? 'فشل' : 'جارٍ'}</small>
              </div>
              <button
                className="icon-button"
                aria-label="حذف التحميل"
                onClick={async () => {
                  await downloadRepository.delete(record.id);
                  setDownloads(downloadRepository.list());
                }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
