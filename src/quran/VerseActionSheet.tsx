import { BookOpen, Bookmark, Clipboard, Headphones, LocateFixed, Repeat, Search, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Ayah, TafsirEntry } from '../core/types';
import { bookmarkRepository } from '../bookmarks/BookmarkRepository';
import { tafsirRepository } from '../tafsir/TafsirRepository';
import { createAyahShareCard } from '../sharing/shareCard';

interface Props {
  ayah: Ayah | null;
  onClose: () => void;
  onPlay: (ayah: Ayah) => void;
  onFindSimilar: (text: string) => void;
  onGoToAyah: (ayah: Ayah) => void;
}

export function VerseActionSheet({ ayah, onClose, onPlay, onFindSimilar, onGoToAyah }: Props) {
  const [tafsir, setTafsir] = useState<TafsirEntry | null>(null);
  const [loadingTafsir, setLoadingTafsir] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTafsir(null);
    setError('');
  }, [ayah?.id]);

  if (!ayah) return null;

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

  const copy = async () => {
    await navigator.clipboard.writeText(`${ayah.text}\n[${ayah.surahName}: ${ayah.ayahNumber}]`);
  };

  const share = async () => {
    const text = `${ayah.text}\nسورة ${ayah.surahName} — الآية ${ayah.ayahNumber}\nصَلِّها — Salliha`;
    if (navigator.share) await navigator.share({ text });
    else await navigator.clipboard.writeText(text);
  };

  const saveImage = async () => {
    const blob = await createAyahShareCard(ayah, document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salliha-${ayah.surahId}-${ayah.ayahNumber}.png`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="خيارات الآية" onClick={onClose}>
      <div className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="section-heading">
          <h2>{ayah.surahName} — {ayah.ayahNumber}</h2>
          <button className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={20} /></button>
        </div>
        <p className="quran-snippet">{ayah.text}</p>
        <div className="sheet-grid">
          <button onClick={() => onPlay(ayah)}><Headphones /> تشغيل الآية</button>
          <button onClick={loadTafsir}><BookOpen /> التفسير</button>
          <button onClick={() => bookmarkRepository.add(ayah.surahId, ayah.ayahNumber)}><Bookmark /> إضافة للعلامات</button>
          <button onClick={copy}><Clipboard /> نسخ</button>
          <button onClick={share}><Share2 /> مشاركة</button>
          <button onClick={saveImage}><Share2 /> صورة مشاركة</button>
          <button onClick={() => onPlay(ayah)}><Repeat /> تكرار</button>
          <button onClick={() => onFindSimilar(ayah.text)}><Search /> البحث عن آيات مشابهة</button>
          <button onClick={() => onGoToAyah(ayah)}><LocateFixed /> الانتقال إلى موضع الآية</button>
        </div>
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
  );
}
