import { Download, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useState } from 'react';
import { formatArabicNumber } from '../core/arabic';
import { quranRepository } from '../quran/QuranRepository';
import { downloadRepository, type DownloadRecord } from '../downloads/DownloadRepository';
import { reciters } from './reciters';
import { useAudio } from './AudioProvider';
import type { RepeatMode } from './audioPlayer';

export function AudioPage() {
  const audio = useAudio();
  const [surahId, setSurahId] = useState(1);
  const [fromAyah, setFromAyah] = useState(1);
  const [toAyah, setToAyah] = useState(7);
  const [hiddenText, setHiddenText] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadRecord | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const surahs = quranRepository.getSurahs();
  const surah = quranRepository.getSurah(surahId) ?? surahs[0];
  const range = surah.verses.slice(Math.max(0, fromAyah - 1), Math.min(surah.ayahCount, toAyah));

  const playRange = () => {
    if (!range.length) return;
    audio.playQueue(range);
    audio.setRepeatMode('range');
  };

  const cacheSurah = async () => {
    setDownloadError('');
    try {
      const reciter = reciters.find((item) => item.id === audio.reciterId) ?? reciters[0];
      await downloadRepository.cacheSurah(reciter, surah.verses, setDownloadStatus);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'تعذر تحميل التلاوة.');
    }
  };

  return (
    <div className="page-grid two-columns">
      <section className="card audio-console">
        <h1>مشغل القرآن</h1>
        <label>القارئ</label>
        <select value={audio.reciterId} onChange={(event) => audio.setReciterId(event.target.value)}>
          {reciters.map((reciter) => <option key={reciter.id} value={reciter.id}>{reciter.name}</option>)}
        </select>
        <label>السورة</label>
        <select value={surahId} onChange={(event) => { const id = Number(event.target.value); setSurahId(id); setToAyah(quranRepository.getSurah(id)?.ayahCount ?? 1); }}>
          {surahs.map((item) => <option key={item.surahId} value={item.surahId}>{item.surahId}. {item.name}</option>)}
        </select>
        <div className="player-now">
          <span>الآية الحالية</span>
          <strong>{audio.currentAyah ? `${audio.currentAyah.surahName} — ${formatArabicNumber(audio.currentAyah.ayahNumber)}` : 'لم يبدأ التشغيل'}</strong>
        </div>
        <div className="player-controls">
          <button onClick={audio.previous} aria-label="السابق"><SkipForward /></button>
          <button className="primary-icon large" onClick={audio.state.isPlaying ? audio.pause : () => audio.currentAyah ? audio.resume() : audio.playSurah(surahId)} aria-label="تشغيل أو إيقاف">
            {audio.state.isPlaying ? <Pause /> : <Play />}
          </button>
          <button onClick={audio.next} aria-label="التالي"><SkipBack /></button>
        </div>
        <div className="control-grid">
          <label>سرعة التشغيل<select value={audio.state.playbackRate} onChange={(event) => audio.setRate(Number(event.target.value))}><option value="0.75">0.75x</option><option value="1">1x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option></select></label>
          <label>التكرار<select value={audio.state.repeatMode} onChange={(event) => audio.setRepeatMode(event.target.value as RepeatMode)}><option value="off">بدون</option><option value="ayah">تكرار الآية</option><option value="range">تكرار النطاق</option><option value="surah">تكرار السورة</option></select></label>
        </div>
      </section>

      <section className="card">
        <h2>القراء</h2>
        <div className="reciter-list">
          {reciters.map((reciter) => (
            <article key={reciter.id} className={audio.reciterId === reciter.id ? 'selected-reciter' : ''}>
              <h3>{reciter.name}</h3>
              <p>{reciter.source}</p>
              <small>{reciter.licenseNote}</small>
              <button onClick={() => audio.setReciterId(reciter.id)}>تحديد كقارئ افتراضي</button>
            </article>
          ))}
        </div>
      </section>

      <section className="card memorization-card">
        <h2>الحفظ والتكرار</h2>
        <div className="range-grid">
          <label>من آية<input type="number" value={fromAyah} min={1} max={surah.ayahCount} onChange={(event) => setFromAyah(Number(event.target.value))} /></label>
          <label>إلى آية<input type="number" value={toAyah} min={fromAyah} max={surah.ayahCount} onChange={(event) => setToAyah(Number(event.target.value))} /></label>
        </div>
        <button className="primary-button" onClick={playRange}><RotateCcw /> تشغيل وتكرار النطاق</button>
        <label className="toggle-row"><span>اختبار الحفظ: إخفاء النص</span><input type="checkbox" checked={hiddenText} onChange={(event) => setHiddenText(event.target.checked)} /></label>
        <div className={`memorization-text ${hiddenText ? 'hidden-text' : ''}`}>
          {range.map((ayah) => <p key={ayah.id}>{ayah.text} <span className="ayah-number">{formatArabicNumber(ayah.ayahNumber)}</span></p>)}
        </div>
        {hiddenText && <button onClick={() => setHiddenText(false)}>إظهار الآية</button>}
      </section>

      <section className="card">
        <h2>Download Manager</h2>
        <p className="muted">يحفظ التلاوة محليًا داخل Cache المتصفح للاستخدام الشخصي Offline عندما تسمح CORS ومساحة الجهاز. لا يعاد توزيع الملفات داخل التطبيق.</p>
        <button className="secondary-button" onClick={cacheSurah}><Download /> تحميل السورة الحالية</button>
        {downloadStatus && <p className="state-note">{downloadStatus.status}: {downloadStatus.downloadedAyat}/{downloadStatus.ayahCount} — {(downloadStatus.bytes / 1024 / 1024).toFixed(2)} MB</p>}
        {downloadError && <p className="error-note">{downloadError}</p>}
      </section>
    </div>
  );
}
