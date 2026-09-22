import { Bookmark, BookmarkCheck, List, Minus, Play, Plus, Search, Type, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Ayah } from '../core/types';
import { formatArabicNumber, stripArabicDiacritics } from '../core/arabic';
import { useAudio } from '../audio/AudioProvider';
import { bookmarkRepository } from '../bookmarks/BookmarkRepository';
import { settingsRepository } from '../settings/settingsRepository';
import { quranRepository } from './QuranRepository';
import { VerseActionSheet } from './VerseActionSheet';

export interface QuranPageProps {
  /** آية مطلوب الانتقال إليها (من البحث أو العلامات). */
  target?: { surahId: number; ayahNumber: number } | null;
  onTargetHandled?: () => void;
}

export function QuranPage({ target, onTargetHandled }: QuranPageProps) {
  const last = bookmarkRepository.getReadingPosition();
  const initial = target ?? last ?? { surahId: 1, ayahNumber: 1 };
  const [surahId, setSurahId] = useState(initial.surahId);
  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null);
  const [query, setQuery] = useState('');
  const [browserOpen, setBrowserOpen] = useState(false);
  const [fontPanelOpen, setFontPanelOpen] = useState(false);
  const [bookmarkVersion, setBookmarkVersion] = useState(0);
  const [reading, setReading] = useState(() => settingsRepository.getSettings().reading);
  const longPressTimer = useRef<number | null>(null);
  const pendingScroll = useRef<{ surahId: number; ayahNumber: number } | null>(null);
  const audio = useAudio();

  const surahs = useMemo(() => quranRepository.getSurahs(), []);
  const surah = quranRepository.getSurah(surahId) ?? surahs[0];
  const visibleSurahs = reading.viewMode === 'flow' ? surahs : [surah];
  const searchResults = useMemo(() => (query.trim().length >= 2 ? quranRepository.searchDetailed(query, 15) : null), [query]);

  const scrollToAyah = useCallback((surahNumber: number, ayahNumber: number) => {
    requestAnimationFrame(() => {
      document.getElementById(`ayah-${surahNumber}-${ayahNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  useEffect(() => {
    if (!target) return;
    setSurahId(target.surahId);
    pendingScroll.current = target;
    onTargetHandled?.();
  }, [onTargetHandled, target]);

  useEffect(() => {
    const pending = pendingScroll.current;
    if (!pending || pending.surahId !== surah.surahId) return;
    const timer = window.setTimeout(() => {
      scrollToAyah(pending.surahId, pending.ayahNumber);
      pendingScroll.current = null;
    }, 80);
    return () => window.clearTimeout(timer);
  }, [scrollToAyah, surah.surahId, surah.verses]);

  useEffect(() => {
    if (reading.viewMode !== 'flow') return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-quran-surah]'));
    if (!sections.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const nextId = Number((visible.target as HTMLElement).dataset.quranSurah);
        if (Number.isFinite(nextId) && nextId !== surahId) setSurahId(nextId);
      }
    }, { rootMargin: '-18% 0px -60% 0px', threshold: [0.1, 0.35, 0.7] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [reading.viewMode, surahs.length, surahId]);

  const savePosition = (ayah: Ayah) => bookmarkRepository.saveReadingPosition({ surahId: ayah.surahId, ayahNumber: ayah.ayahNumber });

  const openAyah = (ayah: Ayah) => {
    setSurahId(ayah.surahId);
    savePosition(ayah);
    pendingScroll.current = { surahId: ayah.surahId, ayahNumber: ayah.ayahNumber };
    setQuery('');
  };

  const updateReading = (patch: Partial<typeof reading>) => {
    const next = settingsRepository.updateSettings((current) => ({ ...current, reading: { ...current.reading, ...patch } })).reading;
    setReading(next);
  };

  return (
    <div className="reader-layout">
      <aside className="reader-sidebar card">
        <div className="section-heading">
          <h2>المصحف</h2>
          <button className="icon-button small" onClick={() => setBrowserOpen(true)} aria-label="اختيار السورة">
            <List size={18} />
          </button>
        </div>
        <button className="surah-current" onClick={() => setBrowserOpen(true)}>
          <span className="ayah-number">{formatArabicNumber(surah.surahId)}</span>
          <span>سورة {surah.name}</span>
          <small>{formatArabicNumber(surah.ayahCount)} آية · {surah.revelationType === 'meccan' ? 'مكية' : 'مدنية'}</small>
        </button>

        <div className="search-box">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في القرآن… (بدون تشكيل)" aria-label="بحث في المصحف" />
          {query && (
            <button className="icon-button small" onClick={() => setQuery('')} aria-label="مسح البحث">
              <X size={16} />
            </button>
          )}
        </div>
        {searchResults && (
          <div className="search-results-mini">
            {searchResults.approximate && <p className="source-note">أقرب النتائج (لم تُطابق كل الكلمات)</p>}
            {searchResults.hits.map((hit) => (
              <button key={hit.ayah.id} onClick={() => openAyah(hit.ayah)}>
                <strong>{hit.ayah.surahName} — {formatArabicNumber(hit.ayah.ayahNumber)}</strong>
                <small>{hit.ayah.text.slice(0, 70)}…</small>
              </button>
            ))}
            {!searchResults.hits.length && <p className="muted">لا نتائج. جرّب كلمة واحدة أو جزءًا من آية.</p>}
          </div>
        )}

        <div className="font-controls">
          <button onClick={() => updateReading({ quranFontScale: Math.max(0.85, Number((reading.quranFontScale - 0.1).toFixed(2))) })} aria-label="تصغير الخط">
            <Minus />
          </button>
          <button className="font-panel-toggle" onClick={() => setFontPanelOpen((value) => !value)}>
            <Type size={16} /> حجم الخط {String(Math.round(reading.quranFontScale * 100))}%
          </button>
          <button onClick={() => updateReading({ quranFontScale: Math.min(2.2, Number((reading.quranFontScale + 0.1).toFixed(2))) })} aria-label="تكبير الخط">
            <Plus />
          </button>
        </div>

        {fontPanelOpen && (
          <div className="font-panel">
            <label>
              نوع الخط
              <select value={reading.quranFontFamily} onChange={(event) => updateReading({ quranFontFamily: event.target.value as typeof reading.quranFontFamily })}>
                <option value="amiriQuran">أميري قرآن (قرآني)</option>
                <option value="notoNaskh">نسخ عربي (Noto Naskh)</option>
              </select>
            </label>
            <label>
              تباعد الأسطر
              <input type="range" min={1.8} max={3.4} step={0.1} value={reading.quranLineHeight} onChange={(event) => updateReading({ quranLineHeight: Number(event.target.value) })} />
            </label>
            <label>
              طريقة العرض
              <select value={reading.viewMode} onChange={(event) => updateReading({ viewMode: event.target.value as typeof reading.viewMode })}>
                <option value="flow">صفحة متصلة (مصحف)</option>
                <option value="ayahList">آية في كل سطر</option>
              </select>
            </label>
            <label className="toggle-row">
              <span>إظهار التشكيل</span>
              <input type="checkbox" checked={reading.showTashkeel} onChange={(event) => updateReading({ showTashkeel: event.target.checked })} />
            </label>
          </div>
        )}

        <p className="source-note">
          مصدر النص: {quranRepository.getMetadata().sourceName} v{quranRepository.getMetadata().sourceVersion} — يتم التحقق من النص عند البناء.
        </p>
      </aside>

      <main
        className={`mushaf-page card view-${reading.viewMode}`}
        aria-label={`سورة ${surah.name}`}
        style={
          {
            '--quran-font-scale': String(reading.quranFontScale),
            '--quran-line-height': String(reading.quranLineHeight),
            '--quran-font-family': reading.quranFontFamily === 'amiriQuran' ? '"Amiri Quran", "Noto Naskh Arabic", serif' : '"Noto Naskh Arabic", "Amiri Quran", serif'
          } as React.CSSProperties
        }
      >
        <div className="mushaf-header">
          <span>{formatArabicNumber(surah.surahId)}</span>
          <h1>سورة {surah.name}</h1>
          <span>{formatArabicNumber(surah.ayahCount)} آية</span>
        </div>

        <div className="mushaf-continuous">
          {visibleSurahs.map((currentSurah) => (
            <section
              key={currentSurah.surahId}
              data-quran-surah={currentSurah.surahId}
              className="mushaf-surah-section"
              aria-label={`سورة ${currentSurah.name}`}
            >
              <div className="mushaf-header">
                <span>{formatArabicNumber(currentSurah.surahId)}</span>
                <h2>سورة {currentSurah.name}</h2>
                <span>{formatArabicNumber(currentSurah.ayahCount)} آية</span>
              </div>
              {currentSurah.surahId !== 1 && currentSurah.surahId !== 9 && (
                <p className="basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
              )}
              <div className="mushaf-frame">
                {currentSurah.verses.map((ayah) => {
                  const isPlaying = audio.currentAyah?.id === ayah.id;
                  const isBookmarked = bookmarkRepository.isBookmarked(ayah.surahId, ayah.ayahNumber);
                  return (
                    <div
                      key={ayah.id}
                      id={`ayah-${ayah.surahId}-${ayah.ayahNumber}`}
                      role="button"
                      tabIndex={0}
                      className={`ayah-block ${isPlaying ? 'is-playing' : ''}`}
                      onClick={() => savePosition(ayah)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedAyah(ayah);
                        }
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setSelectedAyah(ayah);
                      }}
                      onPointerDown={() => {
                        longPressTimer.current = window.setTimeout(() => setSelectedAyah(ayah), 380);
                      }}
                      onPointerUp={() => {
                        if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
                      }}
                      onPointerLeave={() => {
                        if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
                      }}
                    >
                      <span className="ayah-text">{reading.showTashkeel ? ayah.text : stripForDisplay(ayah.text)}</span>
                      <span className="ayah-number">{formatArabicNumber(ayah.ayahNumber)}</span>
                      {isPlaying && (
                        <button
                          className="ayah-play-badge"
                          aria-label="إيقاف التشغيل"
                          onClick={(event) => {
                            event.stopPropagation();
                            audio.pause();
                          }}
                        >
                          <Play size={14} />
                        </button>
                      )}
                      {isBookmarked && <BookmarkCheck className="bookmark-indicator" size={16} data-version={bookmarkVersion} />}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>

      {browserOpen && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="اختيار السورة" onClick={() => setBrowserOpen(false)}>
          <div className="bottom-sheet surah-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="section-heading">
              <h2>اختر السورة</h2>
              <button className="icon-button" onClick={() => setBrowserOpen(false)} aria-label="إغلاق">
                <X size={20} />
              </button>
            </div>
            <div className="surah-grid">
              {surahs.map((item) => (
                <button
                  key={item.surahId}
                  className={item.surahId === surah.surahId ? 'active' : ''}
                  onClick={() => {
                    setSurahId(item.surahId);
                    setBrowserOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <span className="ayah-number">{formatArabicNumber(item.surahId)}</span>
                  <span>{item.name}</span>
                  <small>{formatArabicNumber(item.ayahCount)} آية</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <VerseActionSheet
        ayah={selectedAyah}
        onClose={() => {
          setSelectedAyah(null);
          setBookmarkVersion((value) => value + 1);
        }}
        onFindSimilar={(text) => {
          setQuery(text.slice(0, 60));
          setSelectedAyah(null);
        }}
        onGoToAyah={(ayah) => {
          openAyah(ayah);
          setSelectedAyah(null);
        }}
      />

      <button
        className="bookmark-fab"
        aria-label="علامة على الموضع الحالي"
        onClick={() => {
          const current = bookmarkRepository.getReadingPosition() ?? { surahId, ayahNumber: 1 };
          bookmarkRepository.add(current.surahId, current.ayahNumber, `سورة ${surah.name}`);
          setBookmarkVersion((value) => value + 1);
        }}
      >
        <Bookmark size={20} />
      </button>
    </div>
  );
}

/** إخفاء التشكيل مع الحفاظ على الرسم القرآني (بدون تحويل الحروف). */
function stripForDisplay(text: string): string {
  return stripArabicDiacritics(text);
}
