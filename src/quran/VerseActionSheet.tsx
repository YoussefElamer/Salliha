import { BookOpen, Bookmark, Copy, Headphones, ListMusic, Repeat, Search, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Ayah, TafsirEntry } from '../core/types';
import { formatArabicNumber } from '../core/arabic';
import { bookmarkRepository } from '../bookmarks/BookmarkRepository';
import { tafsirRepository } from '../tafsir/TafsirRepository';
import { createAyahShareCard, shareCardFilename } from '../sharing/shareCard';
import { copyText, shareText } from '../sharing/shareService';
import { ShareSheet } from '../sharing/ShareSheet';
import { useAudio } from '../audio/AudioProvider';

interface Props {
  ayah: Ayah | null;
  onClose: () => void;
  onFindSimilar: (text: string) => void;
  onGoToAyah: (ayah: Ayah) => void;
}

export function VerseActionSheet({ ayah, onClose, onFindSimilar, onGoToAyah }: Props) {
  const audio = useAudio();
  const [tafsir, setTafsir] = useState<TafsirEntry | null>(null);
  const [loadingTafsir, setLoadingTafsir] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBlob, setShareBlob] = useState<Blob | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    setTafsir(null);
    setError('');
    setNotice('');
    setShareBlob(null);
    setShareOpen(false);
    setBookmarked(ayah ? bookmarkRepository.isBookmarked(ayah.surahId, ayah.ayahNumber) : false);
  }, [ayah?.id, ayah]);

  if (!ayah) return null;

  const fullText = `${ayah.text}\n\nسورة ${ayah.surahName} — الآية ${formatArabicNumber(ayah.ayahNumber)}\nصليها — Salliha`;

  const loadTafsir = async () => {
    setLoadingTafsir(true);
    setError('');
    try {
      setTafsir(await tafsirRepository.getTafsir(ayah.surahId, ayah.ayahNumber));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل التفسير.');
    } finally {
      setLoadingTafsir(false);
    }
  };

  const openShare = async () => {
    setError('');
    setShareBlob(null);
    // نفتح ورقة المشاركة فورًا حتى تعمل المشاركة النصية دائمًا، ثم نضيف الصورة عند جاهزيتها.
    setShareOpen(true);
    try {
      const blob = await createAyahShareCard(ayah, document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
      setShareBlob(blob);
    } catch (err) {
      setShareBlob(null);
      setNotice(err instanceof Error ? err.message : 'تعذر تجهيز صورة المشاركة — المشاركة النصية تعمل.');
    }
  };

  return (
    <>
      <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="خيارات الآية" onClick={onClose}>
        <div className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
          <div className="sheet-handle" />
          <div className="section-heading">
            <h2>
              {ayah.surahName} — الآية {formatArabicNumber(ayah.ayahNumber)}
            </h2>
            <button className="icon-button" onClick={onClose} aria-label="إغلاق">
              <X size={20} />
            </button>
          </div>

          <p className="quran-snippet ayah-sheet-text">{ayah.text}</p>

          <div className="sheet-grid">
            <button className="primary-button" onClick={() => audio.playAyah(ayah)}>
              <Headphones /> تشغيل من هذه الآية
            </button>
            <button onClick={() => audio.playAyah(ayah, { single: true })}>
              <Repeat /> تشغيل الآية وحدها
            </button>
            <button onClick={() => { audio.playAyah(ayah); audio.setRepeatMode('ayah'); onClose(); }}>
              <Repeat /> تكرار الآية
            </button>
            <button onClick={() => { audio.playSurah(ayah.surahId, ayah.ayahNumber, { preferSurahFile: false }); onClose(); }}>
              <ListMusic /> تشغيل السورة من هنا
            </button>
            <button onClick={loadTafsir}>
              <BookOpen /> التفسير
            </button>
            <button
              onClick={async () => {
                const outcome = await copyText(fullText);
                setNotice(outcome.status === 'copied' ? outcome.message : 'تعذر النسخ — حدّد النص يدويًا.');
              }}
            >
              <Copy /> نسخ الآية
            </button>
            <button
              onClick={async () => {
                const outcome = await shareText({ text: fullText });
                if (outcome.status === 'copied' || outcome.status === 'unsupported') setNotice(outcome.message);
              }}
            >
              <Share2 /> مشاركة نصية
            </button>
            <button onClick={openShare}>
              <Share2 /> مشاركة كصورة
            </button>
            <button
              onClick={() => {
                if (bookmarked) {
                  const existing = bookmarkRepository.list().find((item) => item.surahId === ayah.surahId && item.ayahNumber === ayah.ayahNumber);
                  if (existing) bookmarkRepository.remove(existing.id);
                  setBookmarked(false);
                  setNotice('تم حذف العلامة.');
                } else {
                  bookmarkRepository.add(ayah.surahId, ayah.ayahNumber, `سورة ${ayah.surahName}`);
                  setBookmarked(true);
                  setNotice('تمت إضافة العلامة.');
                }
              }}
            >
              <Bookmark /> {bookmarked ? 'إزالة العلامة' : 'إضافة للعلامات'}
            </button>
            <button onClick={() => { onFindSimilar(ayah.text); onClose(); }}>
              <Search /> البحث عن آيات مشابهة
            </button>
          </div>

          {notice && <p className="state-note">{notice}</p>}
          {loadingTafsir && <p className="state-note">جاري تحميل التفسير من المصدر...</p>}
          {error && <p className="error-note">{error}</p>}
          {tafsir && (
            <article className="tafsir-box">
              <h3>{tafsir.sourceName}</h3>
              <p>{tafsir.text}</p>
              <small>المصدر: {tafsir.sourceUrl}</small>
            </article>
          )}
        </div>
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={`مشاركة ${ayah.surahName} — ${ayah.ayahNumber}`}
        text={fullText}
        imageBlob={shareBlob}
        imageFilename={shareCardFilename('ayah', `${ayah.surahId}-${ayah.ayahNumber}`)}
      />
    </>
  );
}
