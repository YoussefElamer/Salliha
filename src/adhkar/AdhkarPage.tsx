import { Check, ChevronLeft, ChevronRight, Download, List, Plus, RotateCcw, Search, Share2, Sparkles, Target, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatArabicNumber } from '../core/arabic';
import { settingsRepository } from '../settings/settingsRepository';
import { adhkarRepository, dhikrHaptic } from './AdhkarRepository';
import type { AdhkarItem } from '../core/types';
import { createAdhkarShareCard, shareCardFilename } from '../sharing/shareCard';
import { ShareSheet } from '../sharing/ShareSheet';

export function AdhkarPage() {
  const [version, setVersion] = useState(0);
  const categories = useMemo(() => adhkarRepository.getCategoriesWithCounts(), [version]);
  const [category, setCategory] = useState(() => {
    const last = adhkarRepository.getProgress().lastCategory;
    const available = adhkarRepository.getCategoriesWithCounts();
    if (last && available.some((entry) => entry.name === last)) return last;
    return available[0]?.name ?? '';
  });
  const [query, setQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState(0);
  const [loadingOpenDua, setLoadingOpenDua] = useState(false);
  const [message, setMessage] = useState('');
  const [shareState, setShareState] = useState<{ open: boolean; blob: Blob | null; text: string; title: string; filename: string }>({ open: false, blob: null, text: '', title: '', filename: '' });
  const [viewMode, setViewMode] = useState<'focus' | 'list'>(() => (settingsRepository.getSettings().adhkar.focusMode ? 'focus' : 'list'));
  const [showIndex, setShowIndex] = useState(false);
  const settings = settingsRepository.getSettings().adhkar;
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => (query ? adhkarRepository.search(query) : adhkarRepository.list(category)), [category, query, version]);
  const current: AdhkarItem | null = items[Math.min(focusIndex, Math.max(0, items.length - 1))] ?? null;
  const currentCount = current ? adhkarRepository.getCounter(current.id) : 0;
  const target = current ? Math.max(1, current.count) : 1;
  const done = currentCount >= target;
  const percent = Math.min(100, Math.round((currentCount / target) * 100));
  const completedToday = category ? adhkarRepository.getTodayCompletedCount(category) : 0;
  const remainingInCategory = items.filter((item) => adhkarRepository.getCounter(item.id) >= Math.max(1, item.count)).length;
  const categoryPercent = items.length ? Math.round((remainingInCategory / items.length) * 100) : 0;

  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    if (category) adhkarRepository.saveProgress({ lastCategory: category, lastItemId: current?.id ?? null });
  }, [category, current?.id]);

  useEffect(() => {
    setFocusIndex(0);
    setShowIndex(false);
  }, [category, query]);

  useEffect(() => {
    if (!settings.keepScreenAwake || typeof navigator === 'undefined') return;
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (!wakeLock) return;
    let cancelled = false;
    void wakeLock
      .request('screen')
      .then((lock) => {
        if (cancelled) void lock.release();
        else wakeLockRef.current = lock;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
    };
  }, [settings.keepScreenAwake]);

  const advance = useCallback(
    (index: number) => {
      setFocusIndex(Math.max(0, Math.min(items.length - 1, index)));
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [items.length]
  );

  const count = useCallback(
    (item: AdhkarItem | null = current, index = focusIndex) => {
      if (!item) return;
      const itemTarget = Math.max(1, item.count);
      const next = adhkarRepository.increment(item.id);
      if (settings.hapticFeedback) void dhikrHaptic(next >= itemTarget ? 'success' : 'tick');
      if (next === itemTarget) {
        adhkarRepository.markCompletedToday(item.id);
        if (settings.autoAdvance && viewMode === 'focus' && index < items.length - 1) {
          window.setTimeout(() => setFocusIndex((value) => (value === index ? Math.min(items.length - 1, index + 1) : value)), 650);
        }
      }
      refresh();
    },
    [current, focusIndex, items.length, refresh, settings.autoAdvance, settings.hapticFeedback, viewMode]
  );

  const loadOpenDua = async () => {
    setLoadingOpenDua(true);
    setMessage('');
    try {
      const loaded = await adhkarRepository.loadOpenDuaCatalogue();
      setMessage(`تم تحميل ${formatArabicNumber(loaded)} دعاء من OpenDua وحفظها على هذا الجهاز.`);
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تحميل OpenDua.');
    } finally {
      setLoadingOpenDua(false);
    }
  };

  const shareDhikr = async (item: AdhkarItem) => {
    const text = `${item.content}\n\n${item.categories[0] ?? 'ذكر'} — ${item.source}\nصليها — Salliha`;
    let blob: Blob | null = null;
    try {
      blob = await createAdhkarShareCard(item, document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    } catch {
      blob = null;
    }
    setShareState({ open: true, blob, text, title: item.categories[0] ?? 'ذكر', filename: shareCardFilename('adhkar', item.id) });
  };

  const resetAll = () => {
    if (window.confirm('سيتم تصفير كل عدّادات الأذكار. هل أنت متأكد؟')) {
      adhkarRepository.resetAllCounters();
      refresh();
    }
  };

  return (
    <div className="page-grid">
      <section className="card full-span" ref={topRef}>
        <div className="section-heading">
          <h1>الأذكار</h1>
          <div className="segmented compact">
            <button className={viewMode === 'focus' ? 'active' : ''} onClick={() => setViewMode('focus')}>
              <Target size={16} /> عدّاد
            </button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>
              <List size={16} /> قائمة
            </button>
          </div>
        </div>

        <div className="category-chips">
          {categories.map((entry) => (
            <button
              key={entry.name}
              className={entry.name === category && !query ? 'active' : ''}
              onClick={() => {
                setCategory(entry.name);
                setQuery('');
              }}
            >
              {entry.name}
              <small>{formatArabicNumber(entry.count)}</small>
            </button>
          ))}
        </div>

        <div className="toolbar-row">
          <div className="search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في الأذكار…" aria-label="بحث في الأذكار" />
            {query && (
              <button className="icon-button small" onClick={() => setQuery('')} aria-label="مسح البحث">
                <X size={16} />
              </button>
            )}
          </div>
          <div className="inline-actions">
            <button className="secondary-button" onClick={() => setShowIndex((value) => !value)}>
              <List size={18} /> فهرس الأذكار
            </button>
            <button className="secondary-button" onClick={resetAll}>
              <RotateCcw size={18} /> تصفير العدّادات
            </button>
          </div>
        </div>

        {showIndex && items.length > 0 && (
          <div className="surah-chips" role="list">
            {items.map((item, index) => (
              <button
                key={item.id}
                className={index === focusIndex && !query ? 'active' : ''}
                onClick={() => {
                  setViewMode('focus');
                  setFocusIndex(index);
                }}
              >
                {formatArabicNumber(index + 1)}
              </button>
            ))}
          </div>
        )}

        <div className="adhkar-progress">
          <div className="progress">
            <span style={{ width: `${categoryPercent}%` }} />
          </div>
          <span className="muted">
            {query ? `نتائج البحث: ${formatArabicNumber(items.length)}` : `أكملت ${formatArabicNumber(remainingInCategory)} من ${formatArabicNumber(items.length)} في «${category}»`}
            {!query && completedToday > 0 ? ` — أذكار مكتملة اليوم: ${formatArabicNumber(completedToday)}` : ''}
          </span>
        </div>

        {message && <p className="state-note">{message}</p>}
      </section>

      {!items.length && (
        <section className="card empty-state full-span">
          <h2>لا توجد نتائج</h2>
          <p>{query ? 'جرّب كلمة أخرى من نص الذكر أو اسم التصنيف.' : 'هذا التصنيف فارغ — اختر تصنيفًا آخر من الأعلى.'}</p>
        </section>
      )}

      {viewMode === 'focus' && current && (
        <section className="card full-span focus-card">
          <div className="section-heading">
            <span className="muted">
              {formatArabicNumber(Math.min(focusIndex + 1, items.length))} من {formatArabicNumber(items.length)} — {current.categories[0]}
            </span>
            <div className="inline-actions">
              <button className="icon-button" onClick={() => advance(focusIndex - 1)} disabled={focusIndex === 0} aria-label="الذكر السابق">
                <ChevronRight size={18} />
              </button>
              <button className="icon-button" onClick={() => advance(focusIndex + 1)} disabled={focusIndex >= items.length - 1} aria-label="الذكر التالي">
                <ChevronLeft size={18} />
              </button>
            </div>
          </div>

          <p className="dhikr-text focus-text">{current.content}</p>
          {current.benefit && <p className="muted">{current.benefit}</p>}

          <div className="counter-area">
            <button
              className={`counter-button-large ${done ? 'done' : ''}`}
              style={{ backgroundImage: `conic-gradient(var(--primary) ${percent}%, color-mix(in srgb, var(--primary), transparent 82%) ${percent}% 100%)` }}
              onClick={() => count()}
              aria-label="اضغط للعدّ"
            >
              <span className="counter-inner">
                <span className="counter-value">{formatArabicNumber(currentCount)}</span>
                <span className="counter-target">من {formatArabicNumber(target)}</span>
                {done && <Check className="counter-done-icon" size={26} />}
              </span>
            </button>
            <div className="counter-hint">
              <p className="counter-instruction">اضغط الدائرة الكبيرة عند كل تكرار — لا يوجد أي إدخال يدوي.</p>
              <p className="muted">{current.countDescription}</p>
              <div className="inline-actions">
                <button className="primary-button" onClick={() => count()}>
                  <Plus size={18} /> زيادة
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    adhkarRepository.setCounter(current.id, target);
                    adhkarRepository.markCompletedToday(current.id);
                    refresh();
                  }}
                >
                  <Check size={18} /> وصلت للعدد
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    adhkarRepository.resetCounter(current.id);
                    refresh();
                  }}
                >
                  <RotateCcw size={18} /> تصفير هذا الذكر
                </button>
                <button className="secondary-button" onClick={() => void shareDhikr(current)}>
                  <Share2 size={18} /> مشاركة
                </button>
              </div>
            </div>
          </div>

          <details>
            <summary>المصدر والتخريج</summary>
            <p>{current.source}</p>
            {current.hadithText && <p>{current.hadithText}</p>}
            {current.vocabulary && <p className="muted">{current.vocabulary}</p>}
          </details>
        </section>
      )}

      {viewMode === 'list' &&
        items.map((item) => {
          const itemCount = adhkarRepository.getCounter(item.id);
          const itemTarget = Math.max(1, item.count);
          const itemDone = itemCount >= itemTarget;
          return (
            <article className="card dhikr-card" key={item.id}>
              <div className="section-heading">
                <h2>{item.categories[0]}</h2>
                <span className="muted">{item.countDescription}</span>
              </div>
              <button className="dhikr-tap-area" onClick={() => count(item, -1)} aria-label={`عدّ الذكر — ${itemCount} من ${itemTarget}`}>
                <p className="dhikr-text">{item.content}</p>
              </button>
              {item.benefit && <p className="muted">{item.benefit}</p>}
              <div className="progress">
                <span style={{ width: `${Math.min(100, Math.round((itemCount / itemTarget) * 100))}%` }} />
              </div>
              <div className="counter-panel">
                <button className={`counter-button ${itemDone ? 'done' : ''}`} onClick={() => count(item, -1)} aria-label={`زيادة العداد — ${itemCount} من ${itemTarget}`}>
                  {formatArabicNumber(itemCount)}
                </button>
                <span className="muted">
                  المطلوب: {formatArabicNumber(itemTarget)} {itemDone ? '— تم' : ''}
                </span>
                <div className="inline-actions">
                  <button className="icon-button" onClick={() => { adhkarRepository.resetCounter(item.id); refresh(); }} aria-label="إعادة العداد">
                    <RotateCcw size={18} />
                  </button>
                  <button className="icon-button" onClick={() => void shareDhikr(item)} aria-label="مشاركة">
                    <Share2 size={18} />
                  </button>
                </div>
              </div>
              <details>
                <summary>المصدر والتخريج</summary>
                <p>{item.source}</p>
                {item.hadithText && <p>{item.hadithText}</p>}
              </details>
            </article>
          );
        })}

      <section className="card full-span">
        <div className="section-heading">
          <h2>
            <Sparkles size={18} /> إعدادات سريعة وخيارات متقدمة
          </h2>
        </div>
        <label className="toggle-row">
          <span>اهتزاز عند العدّ</span>
          <input
            type="checkbox"
            checked={settings.hapticFeedback}
            onChange={(event) => settingsRepository.updateSettings((currentSettings) => ({ ...currentSettings, adhkar: { ...currentSettings.adhkar, hapticFeedback: event.target.checked } }))}
          />
        </label>
        <label className="toggle-row">
          <span>الانتقال التلقائي للذكر التالي بعد إكمال العدد</span>
          <input
            type="checkbox"
            checked={settings.autoAdvance}
            onChange={(event) => settingsRepository.updateSettings((currentSettings) => ({ ...currentSettings, adhkar: { ...currentSettings.adhkar, autoAdvance: event.target.checked } }))}
          />
        </label>
        <label className="toggle-row">
          <span>إبقاء الشاشة مضاءة أثناء الذكر</span>
          <input
            type="checkbox"
            checked={settings.keepScreenAwake}
            onChange={(event) => settingsRepository.updateSettings((currentSettings) => ({ ...currentSettings, adhkar: { ...currentSettings.adhkar, keepScreenAwake: event.target.checked } }))}
          />
        </label>
        <div className="inline-actions">
          <button className="secondary-button" disabled={loadingOpenDua} onClick={loadOpenDua}>
            <Download size={18} /> {loadingOpenDua ? 'جاري التحميل…' : 'إضافة أدعية OpenDua (اختياري)'}
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              if (window.confirm('سيتم حذف أدعية OpenDua المحمّلة (تبقى الأذكار المضمّنة). متابعة؟')) {
                adhkarRepository.removeOpenDuaCatalogue();
                refresh();
              }
            }}
          >
            <Download size={18} /> حذف أدعية OpenDua
          </button>
        </div>
        <p className="source-note">
          المصادر: {adhkarRepository.getMetadata().sourceName} — الترخيص {adhkarRepository.getMetadata().license}. {adhkarRepository.getMetadata().attribution} النصوص منقولة حرفيًا ولا تُولَّد بالذكاء الاصطناعي.
        </p>
      </section>

      <ShareSheet
        open={shareState.open}
        onClose={() => setShareState((currentState) => ({ ...currentState, open: false }))}
        title={shareState.title}
        text={shareState.text}
        imageBlob={shareState.blob}
        imageFilename={shareState.filename}
      />
    </div>
  );
}
