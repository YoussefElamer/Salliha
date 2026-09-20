import { Bookmark, Minus, Plus, Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Ayah } from '../core/types';
import { formatArabicNumber } from '../core/arabic';
import { useAudio } from '../audio/AudioProvider';
import { bookmarkRepository } from '../bookmarks/BookmarkRepository';
import { settingsRepository } from '../settings/settingsRepository';
import { quranRepository } from './QuranRepository';
import { VerseActionSheet } from './VerseActionSheet';

export function QuranPage() {
  const last = bookmarkRepository.getReadingPosition();
  const [surahId, setSurahId] = useState(last?.surahId ?? 1);
  const [query, setQuery] = useState('');
  const [jumpAyah, setJumpAyah] = useState(String(last?.ayahNumber ?? 1));
  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null);
  const [fontScale, setFontScale] = useState(settingsRepository.getSettings().quranFontScale);
  const longPressTimer = useRef<number | null>(null);
  const audio = useAudio();
  const surahs = quranRepository.getSurahs();
  const surah = quranRepository.getSurah(surahId) ?? surahs[0];
  const results = useMemo(() => (query ? quranRepository.search(query, 25) : []), [query]);

  const savePosition = (ayah: Ayah) => bookmarkRepository.saveReadingPosition({ surahId: ayah.surahId, ayahNumber: ayah.ayahNumber });
  const openAyah = (ayah: Ayah) => {
    setSurahId(ayah.surahId);
    setJumpAyah(String(ayah.ayahNumber));
    savePosition(ayah);
    requestAnimationFrame(() => document.getElementById(`ayah-${ayah.surahId}-${ayah.ayahNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const pointerDown = (ayah: Ayah) => {
    longPressTimer.current = window.setTimeout(() => setSelectedAyah(ayah), 420);
  };
  const cancelPointer = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
  };

  const updateFont = (next: number) => {
    const clamped = Math.min(1.8, Math.max(0.8, next));
    setFontScale(clamped);
    settingsRepository.updateSettings((settings) => ({ ...settings, quranFontScale: clamped }));
    document.documentElement.style.setProperty('--quran-font-scale', String(clamped));
  };

  return (
    <div className="reader-layout">
      <aside className="reader-sidebar card">
        <h2>المصحف</h2>
        <label>السورة</label>
        <select value={surahId} onChange={(event) => setSurahId(Number(event.target.value))}>
          {surahs.map((item) => <option value={item.surahId} key={item.surahId}>{item.surahId}. {item.name}</option>)}
        </select>
        <label>انتقال إلى آية</label>
        <div className="input-row">
          <input value={jumpAyah} onChange={(event) => setJumpAyah(event.target.value)} inputMode="numeric" />
          <button onClick={() => {
            const ayah = quranRepository.getAyah(surahId, Number(jumpAyah));
            if (ayah) openAyah(ayah);
          }}>اذهب</button>
        </div>
        <label>بحث داخل القرآن</label>
        <div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بدون تشكيل..." /></div>
        {results.length > 0 && <div className="search-results-mini">{results.map((ayah) => <button key={ayah.id} onClick={() => openAyah(ayah)}>{ayah.surahName} — {ayah.ayahNumber}</button>)}</div>}
        <div className="font-controls">
          <button onClick={() => updateFont(fontScale - 0.1)} aria-label="تصغير الخط"><Minus /></button>
          <span>حجم الخط</span>
          <button onClick={() => updateFont(fontScale + 0.1)} aria-label="تكبير الخط"><Plus /></button>
        </div>
        <p className="source-note">مصدر النص: {quranRepository.getMetadata().sourceName} v{quranRepository.getMetadata().sourceVersion}. يتم التحقق قبل البناء.</p>
      </aside>

      <main className="mushaf-page card" aria-label={`سورة ${surah.name}`}>
        <div className="mushaf-header">
          <span>{formatArabicNumber(surah.surahId)}</span>
          <h1>سورة {surah.name}</h1>
          <span>{formatArabicNumber(surah.ayahCount)} آية</span>
        </div>
        <div className="mushaf-frame">
          {surah.verses.map((ayah) => (
            <button
              id={`ayah-${ayah.surahId}-${ayah.ayahNumber}`}
              key={ayah.id}
              className={`ayah-block ${audio.currentAyah?.id === ayah.id ? 'is-playing' : ''}`}
              onClick={() => savePosition(ayah)}
              onContextMenu={(event) => { event.preventDefault(); setSelectedAyah(ayah); }}
              onPointerDown={() => pointerDown(ayah)}
              onPointerUp={cancelPointer}
              onPointerLeave={cancelPointer}
            >
              <span className="ayah-text">{ayah.text}</span>
              <span className="ayah-number">{formatArabicNumber(ayah.ayahNumber)}</span>
              {bookmarkRepository.isBookmarked(ayah.surahId, ayah.ayahNumber) && <Bookmark className="bookmark-indicator" size={18} />}
            </button>
          ))}
        </div>
      </main>

      <VerseActionSheet
        ayah={selectedAyah}
        onClose={() => setSelectedAyah(null)}
        onPlay={(ayah) => { audio.playAyah(ayah); setSelectedAyah(null); }}
        onFindSimilar={(text) => { setQuery(text); setSelectedAyah(null); }}
        onGoToAyah={(ayah) => { openAyah(ayah); setSelectedAyah(null); }}
      />
    </div>
  );
}
