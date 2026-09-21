import { Bookmark, BookmarkCheck, List, Minus, Play, Plus, Search, Type, X } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Ayah } from '../core/types';
import { formatArabicNumber, stripArabicDiacritics } from '../core/arabic';
import { useAudio } from '../audio/AudioProvider';
import { bookmarkRepository } from '../bookmarks/BookmarkRepository';
import { settingsRepository } from '../settings/settingsRepository';
import { quranRepository } from './QuranRepository';
import { VerseActionSheet } from './VerseActionSheet';

const TOTAL_SURAHS = 114;
/** أقصى عدد سور تبقى معمرة في الصفحة معًا — يحافظ على سلاسة التمرير مع تلاوة متصلة. */
const MAX_WINDOW_SPAN = 6;

export interface QuranPageProps {
  /** آية مطلوب الانتقال إليها (من البحث أو العلامات). */
  target?: { surahId: number; ayahNumber: number } | null;
  onTargetHandled?: () => void;
}

/** نطاق السور المعروضة حاليًا (نافذة متحركة وسط المصحف المتصل). */
interface SurahWindow {
  start: number;
  end: number;
}

/** انتقال معلّق إلى آية (0 لرقم الآية = عنوان السورة نفسها). */
interface PendingJump {
  surahId: number;
  ayahNumber: number;
  behavior: ScrollBehavior;
}

/** نافذة أولى حول السورة المطلوبة: سورة قبلها وبعدها مباشرة. */
function windowAround(surahId: number): SurahWindow {
  return { start: Math.max(1, surahId - 1), end: Math.min(TOTAL_SURAHS, surahId + 1) };
}

/**
 * تبني النافذة التالية حول السورة الظاهرة الآن:
 * - دائمًا السورة السابقة والتالية على الأقل (التلاوة متصلة للأمام والخلف).
 * - تحميل مسبق عند الاقتراب من حافتي النافذة حتى لا تنقطع التلاوة أبدًا.
 * - سقف ثابت لعدد السور المحمّلة حتى لا يثقل الـ DOM.
 */
function buildWindow(activeId: number, prev: SurahWindow, topClose: boolean, bottomClose: boolean): SurahWindow {
  let start = Math.min(activeId - 1, topClose ? prev.start - 2 : prev.start);
  let end = Math.max(activeId + 1, bottomClose ? prev.end + 2 : prev.end);
  start = Math.max(1, start);
  end = Math.min(TOTAL_SURAHS, end);
  while (end - start + 1 > MAX_WINDOW_SPAN) {
    if (activeId - start > end - activeId) start += 1;
    else end -= 1;
  }
  if (start > end) return { start: activeId, end: activeId };
  return { start, end };
}

/** ارتفاع الترويسة العلوية اللاصقة — يُتركز عليه لمعرفة السورة الظاهرة. */
function stickyHeaderOffset(): number {
  const header = document.querySelector('.app-header');
  const height = header ? header.getBoundingClientRect().height : 0;
  return height > 8 ? height + 8 : 64;
}

/** أول آية ظاهرة أسفل خط الترويسة (بحث ثنائي — الآيات مرتبة تصاعديًا في الصفحة). */
function findTopVisibleAyah(container: HTMLElement, offset: number): HTMLElement | null {
  const blocks = container.querySelectorAll<HTMLElement>('.ayah-block');
  if (!blocks.length) return null;
  let lo = 0;
  let hi = blocks.length - 1;
  let result: HTMLElement | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (blocks[mid].getBoundingClientRect().bottom > offset) {
      result = blocks[mid];
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return result ?? blocks[0];
}

/** يراقب استقرار التمرير بعد الانتقال ثم يُطلق done — حتى لا تُحسب نافذة أثناء التحليق. */
function watchScrollSettle(el: Element | null | undefined, done: () => void) {
  let lastTop = el?.getBoundingClientRect().top ?? 0;
  let stableTicks = 0;
  let ticks = 0;
  const tick = () => {
    ticks += 1;
    const top = el?.getBoundingClientRect().top ?? 0;
    if (Math.abs(top - lastTop) < 2) stableTicks += 1;
    else stableTicks = 0;
    lastTop = top;
    if (stableTicks >= 2 || ticks >= 20) {
      done();
      return;
    }
    window.setTimeout(tick, 180);
  };
  window.setTimeout(tick, 180);
}

interface AyahBlockProps {
  ayah: Ayah;
  showTashkeel: boolean;
  isPlaying: boolean;
  isBookmarked: boolean;
  onSave: (ayah: Ayah) => void;
  onOpenActions: (ayah: Ayah) => void;
  onPause: () => void;
}

/** كتلة آية واحدة — مُממذَجة حتى لا يُعاد رسم المصحف كله مع كل تغيير صغير. */
const AyahBlock = memo(function AyahBlock({ ayah, showTashkeel, isPlaying, isBookmarked, onSave, onOpenActions, onPause }: AyahBlockProps) {
  const longPressTimer = useRef<number | null>(null);
  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  return (
    <div
      id={`ayah-${ayah.surahId}-${ayah.ayahNumber}`}
      data-surah-id={ayah.surahId}
      data-ayah-number={ayah.ayahNumber}
      role="button"
      tabIndex={0}
      className={`ayah-block ${isPlaying ? 'is-playing' : ''}`}
      onClick={() => onSave(ayah)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenActions(ayah);
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenActions(ayah);
      }}
      onPointerDown={() => {
        clearLongPress();
        longPressTimer.current = window.setTimeout(() => onOpenActions(ayah), 380);
      }}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
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

export function QuranPage({ target, onTargetHandled }: QuranPageProps) {
  // موضع القراءة الأخير يحدد نقطة البداية — والمصحف متصل من هناك.
  const [initial] = useState(() => target ?? bookmarkRepository.getReadingPosition() ?? { surahId: 1, ayahNumber: 1 });
  const [windowRange, setWindowRange] = useState<SurahWindow>(() => windowAround(initial.surahId));
  const [activeSurahId, setActiveSurahId] = useState(initial.surahId);
  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null);
  const [query, setQuery] = useState('');
  const [browserOpen, setBrowserOpen] = useState(false);
  const [fontPanelOpen, setFontPanelOpen] = useState(false);
  const [bookmarkVersion, setBookmarkVersion] = useState(0);
  const [reading, setReading] = useState(() => settingsRepository.getSettings().reading);
  const audio = useAudio();

  const containerRef = useRef<HTMLElement | null>(null);
  const windowRef = useRef<SurahWindow>(windowAround(initial.surahId));
  const activeRef = useRef(initial.surahId);
  const visiblePosRef = useRef({ surahId: initial.surahId, ayahNumber: Math.max(1, initial.ayahNumber) });
  const anchorRef = useRef<{ el: HTMLElement; top: number } | null>(null);
  const pendingScroll = useRef<PendingJump | null>(null);
  const jumpSettling = useRef(false);
  const handledTarget = useRef<string | null>(null);
  const positionTimer = useRef<number | null>(null);
  const lastSavedPos = useRef(`${visiblePosRef.current.surahId}:${visiblePosRef.current.ayahNumber}`);

  const surahs = useMemo(() => quranRepository.getSurahs(), []);
  const activeSurah = quranRepository.getSurah(activeSurahId) ?? surahs[0];
  const surahsInWindow = useMemo(
    () => surahs.filter((item) => item.surahId >= windowRange.start && item.surahId <= windowRange.end),
    [surahs, windowRange]
  );
  const bookmarkKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of bookmarkRepository.list()) keys.add(`${item.surahId}:${item.ayahNumber}`);
    return keys;
  }, [bookmarkVersion]);
  const searchResults = useMemo(() => (query.trim().length >= 2 ? quranRepository.searchDetailed(query, 15) : null), [query]);

  const audioRef = useRef(audio);
  audioRef.current = audio;
  const handlePause = useCallback(() => {
    audioRef.current.pause();
  }, []);
  const handleSave = useCallback((ayah: Ayah) => {
    visiblePosRef.current = { surahId: ayah.surahId, ayahNumber: ayah.ayahNumber };
    lastSavedPos.current = `${ayah.surahId}:${ayah.ayahNumber}`;
    bookmarkRepository.saveReadingPosition({ surahId: ayah.surahId, ayahNumber: ayah.ayahNumber });
  }, []);
  const handleOpenActions = useCallback((ayah: Ayah) => setSelectedAyah(ayah), []);

  /** ينقل إلى آية (أو لعنوان السورة عند ayahNumber = 0) داخل التلاوة المتصلة. */
  const jumpTo = useCallback((surahId: number, ayahNumber: number, behavior: ScrollBehavior) => {
    pendingScroll.current = { surahId, ayahNumber, behavior };
    jumpSettling.current = false;
    visiblePosRef.current = { surahId, ayahNumber: Math.max(1, ayahNumber) };
    const next = windowAround(surahId);
    anchorRef.current = null;
    windowRef.current = next;
    activeRef.current = surahId;
    setActiveSurahId((prev) => (prev === surahId ? prev : surahId));
    setWindowRange(next);
  }, []);

  const openAyah = useCallback(
    (ayah: Ayah) => {
      jumpTo(ayah.surahId, ayah.ayahNumber, 'smooth');
      setQuery('');
    },
    [jumpTo]
  );

  // الانتقال إلى هدف خارجي (بحث، اختصار، رابط).
  useEffect(() => {
    if (!target) {
      handledTarget.current = null;
      return;
    }
    const key = `${target.surahId}:${target.ayahNumber}`;
    if (handledTarget.current === key) return;
    handledTarget.current = key;
    jumpTo(target.surahId, Math.max(1, target.ayahNumber), 'smooth');
    onTargetHandled?.();
  }, [jumpTo, onTargetHandled, target]);

  // عند الفتح بلا هدف: نتابع من آخر موضع قراءة.
  useEffect(() => {
    if (target) return;
    const saved = bookmarkRepository.getReadingPosition();
    if (!saved || (saved.surahId === 1 && saved.ayahNumber <= 1)) return;
    jumpTo(saved.surahId, saved.ayahNumber, 'auto');
    // عند الفتح فقط — التغييرات اللاحقة تمر عبر target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // تنفيذ الانتقال المعلّق بعد توفّر العنصر المطلوب.
  useEffect(() => {
    const pending = pendingScroll.current;
    if (!pending || jumpSettling.current) return;
    if (pending.surahId < windowRange.start || pending.surahId > windowRange.end) return;
    const timer = window.setTimeout(() => {
      const el =
        pending.ayahNumber >= 1
          ? document.getElementById(`ayah-${pending.surahId}-${pending.ayahNumber}`)
          : document.getElementById(`surah-section-${pending.surahId}`);
      el?.scrollIntoView?.({
        behavior: pending.behavior,
        block: pending.ayahNumber >= 1 ? 'center' : 'start'
      });
      jumpSettling.current = true;
      watchScrollSettle(el, () => {
        jumpSettling.current = false;
        pendingScroll.current = null;
      });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [windowRange]);

  const applyWindow = useCallback((next: SurahWindow) => {
    const prev = windowRef.current;
    windowRef.current = next;
    if (next.start === prev.start && next.end === prev.end) return;
    // مرساة تمرير: نثبّت السورة النشطة في مكانها عند إضافة/حذف سور فوقها.
    if (!pendingScroll.current && next.start !== prev.start) {
      const anchorEl = document.getElementById(`surah-section-${activeRef.current}`);
      if (anchorEl) anchorRef.current = { el: anchorEl, top: anchorEl.getBoundingClientRect().top };
    }
    setWindowRange(next);
  }, []);

  // تعويض انزياح الصفحة بعد تغيّر السور المعروضة فوق موضع القراءة.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    anchorRef.current = null;
    if (!anchor?.el?.isConnected) return;
    const delta = anchor.el.getBoundingClientRect().top - anchor.top;
    if (Math.abs(delta) > 1) {
      const root = document.scrollingElement ?? document.documentElement;
      root.scrollTop += delta;
    }
  }, [windowRange]);

  /** مزامنة النافذة مع التمرير: السورة الظاهرة + تمديد/تقليص + حفظ الموضع. */
  const syncWindowState = useCallback(() => {
    if (pendingScroll.current) return;
    const root = document.scrollingElement ?? document.documentElement;
    // لا شيء يُمرَّر (أو بيئة بلا تخطيط مثل الاختبارات) — لا حاجة للمزامنة.
    if (root.scrollHeight <= root.clientHeight + 4) return;
    const container = containerRef.current;
    if (!container) return;

    const sections = Array.from(container.querySelectorAll<HTMLElement>('.surah-section'));
    if (!sections.length) return;

    const offset = stickyHeaderOffset();
    let activeEl = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= offset) activeEl = section;
    }
    const activeId = Number(activeEl.dataset.surahId);
    if (Number.isFinite(activeId)) {
      activeRef.current = activeId;
      setActiveSurahId((prev) => (prev === activeId ? prev : activeId));
    }

    const vh = window.innerHeight || 800;
    const startSentinel = document.getElementById('quran-start-sentinel');
    const endSentinel = document.getElementById('quran-end-sentinel');
    const topClose = startSentinel ? startSentinel.getBoundingClientRect().bottom > -vh * 1.5 : false;
    const bottomClose = endSentinel ? endSentinel.getBoundingClientRect().top < vh * 2 : false;

    applyWindow(buildWindow(activeRef.current, windowRef.current, topClose, bottomClose));

    // حفظ موضع القراءة تلقائيًا (أعلى آية ظاهرة) — مع تأخير بسيط لتقليل الكتابة.
    const topAyah = findTopVisibleAyah(container, offset);
    if (topAyah) {
      const surahId = Number(topAyah.dataset.surahId);
      const ayahNumber = Number(topAyah.dataset.ayahNumber);
      if (Number.isFinite(surahId) && Number.isFinite(ayahNumber)) {
        visiblePosRef.current = { surahId, ayahNumber };
        const key = `${surahId}:${ayahNumber}`;
        if (key !== lastSavedPos.current) {
          lastSavedPos.current = key;
          if (positionTimer.current !== null) window.clearTimeout(positionTimer.current);
          positionTimer.current = window.setTimeout(() => {
            bookmarkRepository.saveReadingPosition({ surahId, ayahNumber });
            positionTimer.current = null;
          }, 700);
        }
      }
    }
  }, [applyWindow]);

  // متابعة التمرير (وبعد كل تغيّر للنافذة) لضمان تلاوة متصلة بلا انقطاع.
  useEffect(() => {
    let queued = false;
    const run = () => {
      queued = false;
      syncWindowState();
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
      else window.setTimeout(run, 32);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [syncWindowState]);

  // بعد كل تغيّر في النافذة نعيد المزامنة مرة — لسلسلة التحميل المسبق حتى تبتعد الحافة.
  useEffect(() => {
    const timer = window.setTimeout(syncWindowState, 0);
    return () => window.clearTimeout(timer);
  }, [syncWindowState, windowRange]);

  useEffect(
    () => () => {
      if (positionTimer.current !== null) window.clearTimeout(positionTimer.current);
    },
    []
  );

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
          <span className="ayah-number">{formatArabicNumber(activeSurah.surahId)}</span>
          <span>سورة {activeSurah.name}</span>
          <small>{formatArabicNumber(activeSurah.ayahCount)} آية · {activeSurah.revelationType === 'meccan' ? 'مكية' : 'مدنية'}</small>
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
        ref={containerRef}
        className={`mushaf-page card view-${reading.viewMode}`}
        aria-label="المصحف — تلاوة متصلة"
        style={
          {
            '--quran-font-scale': String(reading.quranFontScale),
            '--quran-line-height': String(reading.quranLineHeight),
            '--quran-font-family': reading.quranFontFamily === 'amiriQuran' ? '"Amiri Quran", "Noto Naskh Arabic", serif' : '"Noto Naskh Arabic", "Amiri Quran", serif'
          } as React.CSSProperties
        }
      >
        <div id="quran-start-sentinel" className="reader-sentinel" aria-hidden="true" />
        {surahsInWindow.map((item) => (
          <section key={item.surahId} id={`surah-section-${item.surahId}`} className="surah-section" data-surah-id={item.surahId}>
            <header className="mushaf-header" id={`surah-${item.surahId}`}>
              <span className="ayah-number">{formatArabicNumber(item.surahId)}</span>
              <h1>سورة {item.name}</h1>
              <span>{formatArabicNumber(item.ayahCount)} آية</span>
            </header>

            {item.surahId !== 1 && item.surahId !== 9 && <p className="basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>}

            <div className="mushaf-frame">
              {item.verses.map((ayah) => (
                <AyahBlock
                  key={ayah.id}
                  ayah={ayah}
                  showTashkeel={reading.showTashkeel}
                  isPlaying={audio.currentAyah?.id === ayah.id}
                  isBookmarked={bookmarkKeys.has(`${ayah.surahId}:${ayah.ayahNumber}`)}
                  onSave={handleSave}
                  onOpenActions={handleOpenActions}
                  onPause={handlePause}
                />
              ))}
            </div>
          </section>
        ))}
        <div id="quran-end-sentinel" className="reader-sentinel" aria-hidden="true" />
        {windowRange.end === TOTAL_SURAHS && (
          <p className="mushaf-end-mark">﴿ صَدَقَ ٱللَّهُ ٱلْعَظِيمُ ﴾ — تم المصحف بحمد الله</p>
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
                  className={item.surahId === activeSurah.surahId ? 'active' : ''}
                  onClick={() => {
                    jumpTo(item.surahId, 0, 'smooth');
                    setBrowserOpen(false);
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
          const current = visiblePosRef.current;
          const name = quranRepository.getSurah(current.surahId)?.name ?? activeSurah.name;
          bookmarkRepository.add(current.surahId, Math.max(1, current.ayahNumber), `سورة ${name}`);
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
