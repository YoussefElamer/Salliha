import { Bookmark, BookmarkCheck, List, Minus, Play, Plus, Search, Type, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { Ayah, Surah } from '../core/types';
import { formatArabicNumber, stripArabicDiacritics } from '../core/arabic';
import { useAudio } from '../audio/AudioProvider';
import { bookmarkKey, bookmarkRepository } from '../bookmarks/BookmarkRepository';
import { settingsRepository } from '../settings/settingsRepository';
import { quranRepository } from './QuranRepository';
import { VerseActionSheet } from './VerseActionSheet';

export interface QuranPageProps {
  /** آية مطلوب الانتقال إليها (من البحث أو العلامات). */
  target?: { surahId: number; ayahNumber: number } | null;
  onTargetHandled?: () => void;
}

/**
 * صفحة المصحف:
 * - وضع «صفحة متصلة» أو «آية في كل سطر»: سورة واحدة في كل مرة.
 * - وضع «العرض المتصل»: القرآن كاملًا (114 سورة) في صفحة واحدة طويلة —
 *   كلما أنهى القارئ سورة وجد السورة التي تليها مباشرة تحتها عند التمرير،
 *   مع حفظ موضع القراءة تلقائيًا أثناء التمرير.
 */
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
  /** السورة الظاهرة حاليًا أثناء التمرير في العرض المتصل. */
  const [visibleSurahId, setVisibleSurahId] = useState(initial.surahId);
  const [scrollTick, setScrollTick] = useState(0);
  const scrollGoal = useRef<{ surahId: number; ayahNumber: number; behavior: ScrollBehavior; token: number } | null>(null);
  const enteredContinuous = useRef(false);
  const longPressTimer = useRef<number | null>(null);
  const audio = useAudio();
  const audioRef = useRef(audio);
  useEffect(() => {
    audioRef.current = audio;
  });

  // خط القرآن متاح لكل الصفحة (يستفيد منه البحث والمشاركة أيضًا).
  useEffect(() => {
    const value = reading.quranFontFamily === 'amiriQuran' ? '"Amiri Quran", "Noto Naskh Arabic", serif' : '"Noto Naskh Arabic", "Amiri Quran", serif';
    document.documentElement.style.setProperty('--quran-font-family', value);
    return () => {
      document.documentElement.style.removeProperty('--quran-font-family');
    };
  }, [reading.quranFontFamily]);

  const isContinuous = reading.viewMode === 'continuous';
  const surahs = useMemo(() => quranRepository.getSurahs(), []);
  const focusedSurahId = isContinuous ? visibleSurahId : surahId;
  const surah = quranRepository.getSurah(focusedSurahId) ?? surahs[0];
  const searchResults = useMemo(() => (query.trim().length >= 2 ? quranRepository.searchDetailed(query, 15) : null), [query]);
  /** العلامات كمجموعة مفاتيح تُقرأ مرة واحدة (مهمة عند رسم آلاف الآيات في العرض المتصل). */
  const bookmarked = useMemo(() => bookmarkRepository.bookmarkKeys(), [bookmarkVersion]);

  const playingId = audio.currentAyah?.id ?? null;

  const savePosition = useCallback((ayah: Ayah) => {
    bookmarkRepository.saveReadingPosition({ surahId: ayah.surahId, ayahNumber: ayah.ayahNumber });
  }, []);

  const openAyahSheet = useCallback((ayah: Ayah) => setSelectedAyah(ayah), []);
  const pauseAudio = useCallback(() => audioRef.current.pause(), []);

  const scrollToAyah = useCallback((surahNumber: number, ayahNumber: number, behavior: ScrollBehavior) => {
    requestAnimationFrame(() => {
      safeScrollIntoView(document.getElementById(`ayah-${surahNumber}-${ayahNumber}`), { behavior, block: 'center' });
    });
  }, []);

  const scrollToSurahHead = useCallback((surahNumber: number, behavior: ScrollBehavior) => {
    requestAnimationFrame(() => {
      safeScrollIntoView(document.getElementById(`surah-head-${surahNumber}`), { behavior, block: 'start' });
    });
  }, []);

  /** الانتقال إلى آية: يبدّل السورة في العرض العادي، ويمرّر مباشرة في العرض المتصل. */
  const requestScroll = useCallback(
    (destination: { surahId: number; ayahNumber: number }, behavior: ScrollBehavior) => {
      scrollGoal.current = { ...destination, behavior, token: Date.now() };
      if (isContinuous) {
        setVisibleSurahId(destination.surahId);
        const goal = scrollGoal.current;
        window.setTimeout(() => {
          if (scrollGoal.current !== goal) return;
          scrollGoal.current = null;
          safeScrollIntoView(document.getElementById(`ayah-${goal.surahId}-${goal.ayahNumber}`), { behavior: goal.behavior, block: 'center' });
        }, 60);
      } else {
        setSurahId(destination.surahId);
        setScrollTick((value) => value + 1);
      }
    },
    [isContinuous]
  );

  // انتقال وارد من البحث أو العلامات أو روابط الاختصار.
  useEffect(() => {
    if (!target) return;
    setVisibleSurahId(target.surahId);
    requestScroll(target, 'smooth');
    onTargetHandled?.();
  }, [onTargetHandled, requestScroll, target]);

  // تنفيذ الانتقال في وضع السورة الواحدة بعد رسم السورة المطلوبة.
  useEffect(() => {
    if (isContinuous) return;
    const goal = scrollGoal.current;
    if (!goal || goal.surahId !== surahId) return;
    const timer = window.setTimeout(() => {
      if (scrollGoal.current === goal) scrollGoal.current = null;
      scrollToAyah(goal.surahId, goal.ayahNumber, goal.behavior);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [isContinuous, scrollTick, surahId, scrollToAyah]);

  // عند الدخول إلى العرض المتصل: استئناف آخر موضع قراءة فورًا (بدون تمرير متحرك طويل).
  useEffect(() => {
    if (!isContinuous) {
      enteredContinuous.current = false;
      return;
    }
    if (enteredContinuous.current) return;
    enteredContinuous.current = true;
    if (scrollGoal.current) return;
    const position = bookmarkRepository.getReadingPosition() ?? { surahId: 1, ayahNumber: 1 };
    setVisibleSurahId(position.surahId);
    const timer = window.setTimeout(() => {
      safeScrollIntoView(document.getElementById(`ayah-${position.surahId}-${position.ayahNumber}`), { behavior: 'auto', block: 'center' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isContinuous]);

  // تتبّع موضع القراءة أثناء التمرير في العرض المتصل وحفظه تلقائيًا.
  useEffect(() => {
    if (!isContinuous) return;
    let rafId = 0;
    let saveTimer = 0;
    let lastPosition: { surahId: number; ayahNumber: number } | null = null;

    const flush = () => {
      if (lastPosition) bookmarkRepository.saveReadingPosition(lastPosition);
    };

    const probe = () => {
      rafId = 0;
      const element = document.elementFromPoint(window.innerWidth / 2, Math.round(window.innerHeight * 0.35));
      const block = element instanceof Element ? element.closest('.ayah-block') : null;
      if (!(block instanceof HTMLElement)) return;
      const nextSurah = Number(block.dataset.surah);
      const nextAyah = Number(block.dataset.ayah);
      if (!Number.isFinite(nextSurah) || !Number.isFinite(nextAyah)) return;
      setVisibleSurahId((current) => (current === nextSurah ? current : nextSurah));
      lastPosition = { surahId: nextSurah, ayahNumber: nextAyah };
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(flush, 700);
    };

    const onScroll = () => {
      if (!rafId) rafId = window.requestAnimationFrame(probe);
    };
    const onPageHide = () => {
      window.clearTimeout(saveTimer);
      flush();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onPageHide);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.clearTimeout(saveTimer);
      flush();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onPageHide);
    };
  }, [isContinuous]);

  const openAyah = (ayah: Ayah) => {
    savePosition(ayah);
    requestScroll({ surahId: ayah.surahId, ayahNumber: ayah.ayahNumber }, 'smooth');
    setQuery('');
  };

  const updateReading = (patch: Partial<typeof reading>) => {
    const next = settingsRepository.updateSettings((current) => ({ ...current, reading: { ...current.reading, ...patch } })).reading;
    // عند الخروج من العرض المتصل نكمل القراءة من السورة التي كان يقرؤها المستخدم.
    if (reading.viewMode === 'continuous' && next.viewMode !== 'continuous') {
      setSurahId(visibleSurahId);
    }
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
          <small>
            {formatArabicNumber(surah.ayahCount)} آية · {surah.revelationType === 'meccan' ? 'مكية' : 'مدنية'}
            {isContinuous ? ' — العرض المتصل' : ''}
          </small>
        </button>
        {isContinuous && (
          <p className="state-note continuous-hint">
            المصحف كاملًا في تمرير واحد: كلما أنهيت سورة وجدت التي تليها مباشرة، ويُحفظ موضعك تلقائيًا أثناء القراءة.
          </p>
        )}

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
                <option value="continuous">المصحف كاملًا (تمرير متصل)</option>
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
        aria-label={isContinuous ? 'المصحف كاملًا — عرض متصل' : `سورة ${surah.name}`}
        style={
          {
            '--quran-font-scale': String(reading.quranFontScale),
            '--quran-line-height': String(reading.quranLineHeight),
            '--quran-font-family': reading.quranFontFamily === 'amiriQuran' ? '"Amiri Quran", "Noto Naskh Arabic", serif' : '"Noto Naskh Arabic", "Amiri Quran", serif'
          } as React.CSSProperties
        }
      >
        {isContinuous ? (
          <ContinuousMushaf
            surahs={surahs}
            showTashkeel={reading.showTashkeel}
            playingId={playingId}
            bookmarked={bookmarked}
            onAyahTap={savePosition}
            onAyahOpen={openAyahSheet}
            onPause={pauseAudio}
          />
        ) : (
          <>
            <div className="mushaf-header">
              <span>{formatArabicNumber(surah.surahId)}</span>
              <h1>سورة {surah.name}</h1>
              <span>{formatArabicNumber(surah.ayahCount)} آية</span>
            </div>

            {surah.surahId !== 1 && surah.surahId !== 9 && <p className="basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>}

            <div className="mushaf-frame" key={surah.surahId}>
              {surah.verses.map((ayah) => (
                <AyahBlock
                  key={ayah.id}
                  ayah={ayah}
                  showTashkeel={reading.showTashkeel}
                  isPlaying={playingId === ayah.id}
                  isBookmarked={bookmarked.has(bookmarkKey(ayah.surahId, ayah.ayahNumber))}
                  onTap={savePosition}
                  onOpen={openAyahSheet}
                  onPause={pauseAudio}
                  longPressRef={longPressTimer}
                />
              ))}
            </div>
          </>
        )}
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
                  className={item.surahId === focusedSurahId ? 'active' : ''}
                  onClick={() => {
                    setBrowserOpen(false);
                    if (isContinuous) {
                      setVisibleSurahId(item.surahId);
                      scrollToSurahHead(item.surahId, 'smooth');
                    } else {
                      requestScroll({ surahId: item.surahId, ayahNumber: 1 }, 'smooth');
                    }
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
          const current = bookmarkRepository.getReadingPosition() ?? { surahId: focusedSurahId, ayahNumber: 1 };
          bookmarkRepository.add(current.surahId, current.ayahNumber, `سورة ${surah.name}`);
          setBookmarkVersion((value) => value + 1);
        }}
      >
        <Bookmark size={20} />
      </button>
    </div>
  );
}

interface AyahBlockProps {
  ayah: Ayah;
  showTashkeel: boolean;
  isPlaying: boolean;
  isBookmarked: boolean;
  onTap: (ayah: Ayah) => void;
  onOpen: (ayah: Ayah) => void;
  onPause: () => void;
  longPressRef: MutableRefObject<number | null>;
}

/** آية واحدة — نفس المكوّن في وضع السورة الواحدة وفي العرض المتصل. */
const AyahBlock = memo(function AyahBlock({ ayah, showTashkeel, isPlaying, isBookmarked, onTap, onOpen, onPause, longPressRef }: AyahBlockProps) {
  return (
    <div
      id={`ayah-${ayah.surahId}-${ayah.ayahNumber}`}
      data-surah={ayah.surahId}
      data-ayah={ayah.ayahNumber}
      role="button"
      tabIndex={0}
      className={`ayah-block ${isPlaying ? 'is-playing' : ''}`}
      onClick={() => onTap(ayah)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(ayah);
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpen(ayah);
      }}
      onPointerDown={() => {
        longPressRef.current = window.setTimeout(() => onOpen(ayah), 380);
      }}
      onPointerUp={() => {
        if (longPressRef.current) window.clearTimeout(longPressRef.current);
      }}
      onPointerLeave={() => {
        if (longPressRef.current) window.clearTimeout(longPressRef.current);
      }}
    >
      <span className="ayah-text">{showTashkeel ? ayah.text : stripForDisplay(ayah.text)}</span>
      <span className="ayah-number">{formatArabicNumber(ayah.ayahNumber)}</span>
      {isPlaying && (
        <button
          className="ayah-play-badge"
          aria-label="إيقاف التشغيل"
          onClick={(event) => {
            event.stopPropagation();
            onPause();
          }}
        >
          <Play size={14} />
        </button>
      )}
      {isBookmarked && <BookmarkCheck className="bookmark-indicator" size={16} />}
    </div>
  );
});

interface ContinuousMushafProps {
  surahs: Surah[];
  showTashkeel: boolean;
  playingId: string | null;
  bookmarked: Set<string>;
  onAyahTap: (ayah: Ayah) => void;
  onAyahOpen: (ayah: Ayah) => void;
  onPause: () => void;
}

/**
 * المصحف كاملًا في وثيقة واحدة: السور الـ114 متتابعة بالترتيب،
 * نهاية كل سورة يليها مباشرة مطلع السورة التي بعدها.
 * نستخدم `content-visibility: auto` (في التنسيقات) حتى يتجاهل المتصفح
 * رسم السور البعيدة عن الشاشة، فيبقى التمرير سلسًا على الجوال.
 */
const ContinuousMushaf = memo(function ContinuousMushaf({ surahs, showTashkeel, playingId, bookmarked, onAyahTap, onAyahOpen, onPause }: ContinuousMushafProps) {
  const longPressRef = useRef<number | null>(null);
  return (
    <div className="mushaf-frame continuous-frame">
      {surahs.map((item) => (
        <section key={item.surahId} className="surah-section" id={`surah-${item.surahId}`} data-surah-id={item.surahId} aria-label={`سورة ${item.name}`}>
          <header className="mushaf-header surah-head" id={`surah-head-${item.surahId}`}>
            <span>{formatArabicNumber(item.surahId)}</span>
            <h2>سورة {item.name}</h2>
            <span>{formatArabicNumber(item.ayahCount)} آية</span>
          </header>
          {item.surahId !== 1 && item.surahId !== 9 && <p className="basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>}
          <div className="surah-text">
            {item.verses.map((ayah) => (
              <AyahBlock
                key={ayah.id}
                ayah={ayah}
                showTashkeel={showTashkeel}
                isPlaying={playingId === ayah.id}
                isBookmarked={bookmarked.has(bookmarkKey(ayah.surahId, ayah.ayahNumber))}
                onTap={onAyahTap}
                onOpen={onAyahOpen}
                onPause={onPause}
                longPressRef={longPressRef}
              />
            ))}
          </div>
        </section>
      ))}
      <p className="mushaf-end-note">نهاية المصحف الشريف</p>
    </div>
  );
});

/** إخفاء التشكيل مع الحفاظ على الرسم القرآني (بدون تحويل الحروف). */
function stripForDisplay(text: string): string {
  return stripArabicDiacritics(text);
}

/** تمرير آمن: بعض البيئات (مثل jsdom في الاختبارات) لا تنفّذ scrollIntoView. */
function safeScrollIntoView(element: HTMLElement | null, options: ScrollIntoViewOptions): void {
  if (!element || typeof element.scrollIntoView !== 'function') return;
  element.scrollIntoView(options);
}
