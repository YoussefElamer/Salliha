import { BookOpen, Headphones, Play, Share2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AppRoute, RouteParams } from '../app/navigation';
import { formatArabicNumber } from '../core/arabic';
import { bookmarkRepository } from '../bookmarks/BookmarkRepository';
import { quranRepository } from '../quran/QuranRepository';
import { useAudio } from '../audio/AudioProvider';
import { createAyahShareCard, shareCardFilename } from '../sharing/shareCard';
import { ShareSheet } from '../sharing/ShareSheet';

export function ProfilePage({ navigate }: { navigate: (route: AppRoute, params?: RouteParams) => void }) {
  const [bookmarks, setBookmarks] = useState(() => bookmarkRepository.list());
  const [shareState, setShareState] = useState<{ open: boolean; blob: Blob | null; text: string; title: string; filename: string }>({ open: false, blob: null, text: '', title: '', filename: '' });
  const audio = useAudio();
  const last = bookmarkRepository.getReadingPosition();
  const grouped = useMemo(() => {
    const map = new Map<number, typeof bookmarks>();
    for (const bookmark of bookmarks) {
      map.set(bookmark.surahId, [...(map.get(bookmark.surahId) ?? []), bookmark]);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [bookmarks]);

  return (
    <div className="page-grid">
      <section className="card full-span">
        <h1>مساحتي</h1>
        <p className="muted">
          بدون تسجيل دخول — العلامات وآخر موضع قراءة محفوظة على جهازك فقط. {last ? `آخر قراءة: سورة ${quranRepository.getSurah(last.surahId)?.name} — الآية ${formatArabicNumber(last.ayahNumber)}.` : 'لا يوجد موضع قراءة محفوظ بعد.'}
        </p>
        <div className="stats-grid">
          <div><strong>{formatArabicNumber(bookmarks.length)}</strong><span>علامة محفوظة</span></div>
          <div><strong>{formatArabicNumber(grouped.length)}</strong><span>سورة تحتوي علامات</span></div>
          <div><strong>{last ? formatArabicNumber(last.ayahNumber) : '—'}</strong><span>آخر آية قرأتها</span></div>
        </div>
        {last && (
          <div className="inline-actions">
            <button className="primary-button" onClick={() => navigate('quran', { surahId: last.surahId, ayahNumber: last.ayahNumber })}>
              <BookOpen size={18} /> متابعة القراءة
            </button>
          </div>
        )}
      </section>

      {grouped.map(([surahId, items]) => (
        <section className="card" key={surahId}>
          <div className="section-heading">
            <h2>سورة {quranRepository.getSurah(surahId)?.name ?? surahId}</h2>
            <span className="muted">{formatArabicNumber(items.length)} علامة</span>
          </div>
          <div className="result-list">
            {items.map((bookmark) => {
              const ayah = quranRepository.getAyah(bookmark.surahId, bookmark.ayahNumber);
              return (
                <article className="result-item" key={bookmark.id}>
                  <div className="result-main">
                    <h3>{bookmark.label} — الآية {formatArabicNumber(bookmark.ayahNumber)}</h3>
                    {ayah && <p className="quran-snippet">{ayah.text}</p>}
                  </div>
                  <div className="inline-actions">
                    {ayah && (
                      <>
                        <button onClick={() => navigate('quran', { surahId: bookmark.surahId, ayahNumber: bookmark.ayahNumber })}><BookOpen size={18} /> فتح</button>
                        <button onClick={() => audio.playAyah(ayah)}><Play size={18} /> تشغيل</button>
                        <button
                          onClick={async () => {
                            const text = `${ayah.text}\n\nسورة ${ayah.surahName} — الآية ${formatArabicNumber(ayah.ayahNumber)}\nصليها — Salliha`;
                            const title = `${ayah.surahName} — ${ayah.ayahNumber}`;
                            const filename = shareCardFilename('ayah', `${ayah.surahId}-${ayah.ayahNumber}`);
                            setShareState({ open: true, blob: null, text, title, filename });
                            try {
                              const blob = await createAyahShareCard(ayah, document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
                              setShareState({ open: true, blob, text, title, filename });
                            } catch {
                              // المشاركة النصية متاحة دائمًا حتى لو فشل توليد الصورة.
                            }
                          }}
                        >
                          <Share2 size={18} /> مشاركة
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        bookmarkRepository.remove(bookmark.id);
                        setBookmarks(bookmarkRepository.list());
                      }}
                    >
                      <Trash2 size={18} /> حذف
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {!bookmarks.length && (
        <section className="card empty-state full-span">
          <h2>لا توجد علامات بعد</h2>
          <p>اضغط مطولًا على أي آية في المصحف لإضافة علامة، أو استخدم زر العلامة أثناء القراءة.</p>
          <div className="inline-actions">
            <button className="primary-button" onClick={() => navigate('quran')}><BookOpen size={18} /> افتح المصحف</button>
            <button className="secondary-button" onClick={() => navigate('audio')}><Headphones size={18} /> الاستماع للتلاوة</button>
          </div>
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
