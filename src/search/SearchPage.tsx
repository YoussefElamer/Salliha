import { BookOpen, Bookmark, Headphones, Mic, Search, Share2, Sparkles, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { AdhkarItem, Ayah, SearchResult } from '../core/types';
import type { AppRoute } from '../app/navigation';
import { formatArabicNumber, highlightMatches } from '../core/arabic';
import { appSearchRepository } from './searchRepository';
import { useAudio } from '../audio/AudioProvider';
import { bookmarkRepository } from '../bookmarks/BookmarkRepository';
import { isVoiceSearchSupported, voiceSearchOnce } from './voiceSearch';
import { createAyahShareCard, shareCardFilename } from '../sharing/shareCard';
import { ShareSheet } from '../sharing/ShareSheet';

const labels: Record<SearchResult['type'], string> = {
  ayah: 'آيات قرآنية',
  surah: 'سور',
  adhkar: 'أذكار وأدعية',
  reciter: 'قرّاء',
  tafsir: 'تفسير',
  prayer: 'مواقيت'
};

export function SearchPage({ navigate, onOpenAyah }: { navigate: (route: AppRoute) => void; onOpenAyah?: (surahId: number, ayahNumber: number) => void }) {
  const [query, setQuery] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [listening, setListening] = useState(false);
  const [shareState, setShareState] = useState<{ open: boolean; blob: Blob | null; text: string; title: string; filename: string }>({ open: false, blob: null, text: '', title: '', filename: '' });
  const deferredQuery = useDeferredValue(query);
  const audio = useAudio();

  const results = useMemo(() => appSearchRepository.search(deferredQuery), [deferredQuery]);
  const grouped = useMemo(
    () =>
      results.reduce<Record<string, SearchResult[]>>((acc, result) => {
        acc[result.type] = [...(acc[result.type] ?? []), result];
        return acc;
      }, {}),
    [results]
  );

  useEffect(() => {
    setVoiceError('');
  }, [query]);

  const openAyah = (ayah: Ayah) => {
    bookmarkRepository.saveReadingPosition({ surahId: ayah.surahId, ayahNumber: ayah.ayahNumber });
    if (onOpenAyah) onOpenAyah(ayah.surahId, ayah.ayahNumber);
    else navigate('quran');
  };

  const shareAyah = async (ayah: Ayah) => {
    const text = `${ayah.text}\n\nسورة ${ayah.surahName} — الآية ${formatArabicNumber(ayah.ayahNumber)}\nصليها — Salliha`;
    const blob = await createAyahShareCard(ayah, document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    setShareState({ open: true, blob, text, title: `${ayah.surahName} — ${ayah.ayahNumber}`, filename: shareCardFilename('ayah', `${ayah.surahId}-${ayah.ayahNumber}`) });
  };

  const startVoice = async () => {
    setVoiceError('');
    setListening(true);
    try {
      const result = await voiceSearchOnce({ lang: 'ar-SA' });
      setQuery(result.transcript);
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : 'تعذر البحث الصوتي');
    } finally {
      setListening(false);
    }
  };

  const renderText = (result: SearchResult) => {
    if (!result.text) return null;
    const segments = highlightMatches(result.text, deferredQuery);
    return (
      <p className={result.type === 'ayah' ? 'quran-snippet' : ''}>
        {segments.map((segment, index) =>
          segment.match ? (
            <mark key={index} className="search-highlight">
              {segment.text}
            </mark>
          ) : (
            <span key={index}>{segment.text}</span>
          )
        )}
      </p>
    );
  };

  return (
    <div className="page-grid">
      <section className="card full-span">
        <h1>البحث</h1>
        <p className="muted">
          بحث فوري داخل المصحف كاملًا (٦٢٣٦ آية) بدون تشكيل، مع دعم اسم السورة ورقم الآية (مثل «٢:٢٥٥» أو «البقرة ٢٥٥»). الفهرس يُبنى على الجهاز، ويعمل بدون إنترنت.
        </p>
        <div className="search-box large">
          <Search />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: فاصبر صبرا جميلا" aria-label="نص البحث" />
          {query && (
            <button className="icon-button small" onClick={() => setQuery('')} aria-label="مسح البحث">
              <X size={16} />
            </button>
          )}
          {isVoiceSearchSupported() && (
            <button aria-label="بحث صوتي" className="icon-button" onClick={startVoice} disabled={listening}>
              <Mic size={20} />
            </button>
          )}
        </div>
        {listening && <p className="state-note">يستمع... تحدث الآن</p>}
        {voiceError && <p className="error-note">{voiceError}</p>}
        {deferredQuery.trim().length >= 2 && (
          <p className="source-note">
            {results.length ? `تم العثور على ${formatArabicNumber(results.length)} نتيجة` : 'لا نتائج مطابقة'} — البحث يجري على الجهاز بدون إرسال أي كلمة للإنترنت.
          </p>
        )}
      </section>

      {!query && (
        <section className="card empty-state">
          <h2>اكتب كلمة أو جزءًا من آية</h2>
          <p>يعمل البحث بدون تشكيل: «صبرا جميلا» و«فاصبر صبرا جميلا» يعطيان نفس النتيجة. ويمكنك البحث عن سورة بالاسم أو رقمها.</p>
        </section>
      )}

      {Object.entries(grouped).map(([type, group]) => (
        <section className="card full-span" key={type}>
          <h2>{labels[type as SearchResult['type']] ?? type}</h2>
          <div className="result-list">
            {group.map((result) => {
              const ayah = result.type === 'ayah' ? (result.payload as Ayah) : null;
              const adhkar = result.type === 'adhkar' ? (result.payload as AdhkarItem) : null;
              return (
                <article key={result.id} className="result-item">
                  <div className="result-main">
                    <h3>{result.title}</h3>
                    {result.subtitle && <small>{result.subtitle}</small>}
                    {renderText(result)}
                  </div>
                  <div className="inline-actions">
                    {ayah && (
                      <>
                        <button onClick={() => audio.playAyah(ayah)} aria-label={`تشغيل ${ayah.surahName}`}>
                          <Headphones size={18} /> تشغيل
                        </button>
                        <button onClick={() => openAyah(ayah)}>
                          <BookOpen size={18} /> فتح في المصحف
                        </button>
                        <button onClick={() => bookmarkRepository.add(ayah.surahId, ayah.ayahNumber, 'من البحث')}>
                          <Bookmark size={18} /> علامة
                        </button>
                        <button onClick={() => void shareAyah(ayah)}>
                          <Share2 size={18} /> مشاركة
                        </button>
                      </>
                    )}
                    {adhkar && (
                      <button onClick={() => navigate('adhkar')}>
                        <Sparkles size={18} /> فتح في الأذكار
                      </button>
                    )}
                    {result.type === 'surah' && <button onClick={() => openAyah({ surahId: (result.payload as { surahId: number }).surahId, ayahNumber: 1 } as Ayah)}><BookOpen size={18} /> فتح السورة</button>}
                    {result.type === 'reciter' && <button onClick={() => navigate('audio')}><Headphones size={18} /> فتح التلاوة</button>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {query && results.length === 0 && (
        <section className="card empty-state">
          <h2>لا توجد نتائج مطابقة</h2>
          <p>جرّب كلمات أقل، أو ابحث بجزء من الآية بدون تشكيل. ولن يعرض التطبيق أي تخمين على أنه آية.</p>
        </section>
      )}

      <ShareSheet
        open={shareState.open}
        onClose={() => setShareState((current) => ({ ...current, open: false }))}
        title={shareState.title}
        text={shareState.text}
        imageBlob={shareState.blob}
        imageFilename={shareState.filename}
      />
    </div>
  );
}
