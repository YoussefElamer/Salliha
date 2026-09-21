import { Clipboard, Copy, Download, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { copyImage, copyText, saveImage, shareImage, shareText, type ShareOutcome } from './shareService';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  imageBlob: Blob | null;
  imageFilename: string;
}

function outcomeToMessage(outcome: ShareOutcome): { tone: 'ok' | 'warn'; message: string } | null {
  switch (outcome.status) {
    case 'shared':
      return { tone: 'ok', message: 'تمت المشاركة.' };
    case 'copied':
    case 'downloaded':
      return { tone: 'ok', message: outcome.message };
    case 'cancelled':
      return null;
    case 'unsupported':
      return { tone: 'warn', message: outcome.message };
    default:
      return null;
  }
}

/** ورقة مشاركة موحّدة: تعرض معاينة الصورة وتُظهر نتيجة كل إجراء بوضوح بدل الفشل الصامت. */
export function ShareSheet({ open, onClose, title, text, imageBlob, imageFilename }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'warn'; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!imageBlob) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageBlob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageBlob]);

  useEffect(() => {
    if (open) setStatus(null);
  }, [open]);

  if (!open) return null;

  const run = async (key: string, action: () => Promise<ShareOutcome>) => {
    setBusy(key);
    setStatus(null);
    try {
      const outcome = await action();
      setStatus(outcomeToMessage(outcome));
    } catch (error) {
      setStatus({ tone: 'warn', message: error instanceof Error ? error.message : 'تعذر تنفيذ العملية.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="مشاركة" onClick={onClose}>
      <div className="bottom-sheet share-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="section-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>

        {imageUrl ? (
          <div className="share-preview">
            <img src={imageUrl} alt={`صورة ${title}`} />
          </div>
        ) : (
          <p className="state-note">لم تتوفر صورة على هذا الجهاز — المشاركة النصية جاهزة بالأسفل وتعمل دائمًا.</p>
        )}

        <div className="sheet-grid">
          <button disabled={busy !== null} onClick={() => run('image-share', () => (imageBlob ? shareImage(imageBlob, imageFilename, { title, text }) : shareText({ title, text })))}>
            <Share2 /> {busy === 'image-share' ? 'جارٍ…' : imageBlob ? 'مشاركة الصورة' : 'مشاركة النص'}
          </button>
          <button disabled={busy !== null} onClick={() => run('image-save', () => (imageBlob ? saveImage(imageBlob, imageFilename) : Promise.resolve({ status: 'unsupported', message: 'لا توجد صورة.' } as ShareOutcome)))}>
            <Download /> {busy === 'image-save' ? 'جارٍ…' : 'حفظ الصورة'}
          </button>
          <button disabled={busy !== null} onClick={() => run('image-copy', () => (imageBlob ? copyImage(imageBlob) : Promise.resolve({ status: 'unsupported', message: 'لا توجد صورة.' } as ShareOutcome)))}>
            <Clipboard /> {busy === 'image-copy' ? 'جارٍ…' : 'نسخ الصورة'}
          </button>
          <button disabled={busy !== null} onClick={() => run('text-share', () => shareText({ title, text }))}>
            <Share2 /> {busy === 'text-share' ? 'جارٍ…' : 'مشاركة النص'}
          </button>
          <button disabled={busy !== null} onClick={() => run('text-copy', () => copyText(text))}>
            <Copy /> {busy === 'text-copy' ? 'جارٍ…' : 'نسخ النص'}
          </button>
          <button className="primary-button" onClick={onClose}>
            تم
          </button>
        </div>

        <p className="share-text-preview">{text}</p>
        {status && <p className={status.tone === 'ok' ? 'state-note' : 'error-note'}>{status.message}</p>}
      </div>
    </div>
  );
}
