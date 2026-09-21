import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';

export type ShareOutcome =
  | { status: 'shared' }
  | { status: 'copied'; message: string }
  | { status: 'downloaded'; message: string }
  | { status: 'cancelled' }
  | { status: 'unsupported'; message: string };

export function isNativeApp(): boolean {
  const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(capacitor?.isNativePlatform?.());
}

export function canShareText(): boolean {
  return isNativeApp() || typeof navigator !== 'undefined';
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // بعض WebViews تمنع الحافظة بدون تفاعل مباشر — نجرّب الطريقة القديمة.
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export async function copyText(text: string, successMessage = 'تم نسخ النص إلى الحافظة.'): Promise<ShareOutcome> {
  const copied = await copyToClipboard(text);
  return copied ? { status: 'copied', message: successMessage } : { status: 'unsupported', message: 'تعذر النسخ على هذا الجهاز. جرّب تحديد النص يدويًا.' };
}

/** مشاركة نص: يجرّب Capacitor Share ثم Web Share ثم الحافظة. */
export async function shareText(options: { title?: string; text: string; dialogTitle?: string }): Promise<ShareOutcome> {
  const { title = 'صليها — Salliha', text, dialogTitle = 'مشاركة' } = options;
  if (isNativeApp()) {
    try {
      await Share.share({ title, text, dialogTitle });
      return { status: 'shared' };
    } catch (error) {
      if (isUserCancellation(error)) return { status: 'cancelled' };
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return { status: 'shared' };
    } catch (error) {
      if (isUserCancellation(error)) return { status: 'cancelled' };
    }
  }
  return copyText(text, 'المشاركة غير مدعومة على هذا الجهاز — تم نسخ النص بدلًا منها.');
}

function isUserCancellation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /cancel|abort|dismiss/i.test(error.message) || (error as Error).name === 'AbortError';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('تعذر تجهيز الصورة.'));
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** مشاركة صورة: Capacitor (حفظ مؤقت + مشاركة الملف) ثم Web Share للملفات ثم التنزيل. */
export async function shareImage(blob: Blob, filename: string, options: { title?: string; text?: string; dialogTitle?: string } = {}): Promise<ShareOutcome> {
  const { title = 'صليها — Salliha', text, dialogTitle = 'مشاركة صورة' } = options;

  if (isNativeApp()) {
    const base64 = await blobToBase64(blob);
    try {
      const written = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
        recursive: true
      });
      // على أندرويد/iOS نمرّر الملف عبر FileProvider (مجلد cache مُعلن في file_paths.xml).
      await Share.share({ title, text, dialogTitle, files: [written.uri] });
      return { status: 'shared' };
    } catch (error) {
      if (isUserCancellation(error)) return { status: 'cancelled' };
      // فشل المشاركة الأصلية → نحفظ الصورة في الاستوديو بدلًا من الفشل الصامت.
      return saveImage(blob, filename);
    }
  }

  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  const shareData = { files: [file], title, text } as ShareData;
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share(shareData);
      return { status: 'shared' };
    } catch (error) {
      if (isUserCancellation(error)) return { status: 'cancelled' };
    }
  }

  downloadBlob(blob, filename);
  return { status: 'downloaded', message: 'تم حفظ الصورة في التنزيلات. يمكنك مشاركتها من معرض الصور.' };
}

/** حفظ الصورة داخل الجهاز (على Native: مجلد الصور، على الويب: تنزيل مباشر). */
export async function saveImage(blob: Blob, filename: string): Promise<ShareOutcome> {
  if (isNativeApp()) {
    try {
      const base64 = await blobToBase64(blob);
      await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Documents,
        recursive: true
      });
      return { status: 'downloaded', message: 'تم حفظ الصورة في مجلد المستندات داخل الجهاز.' };
    } catch (error) {
      if (error instanceof Error && /denied/i.test(error.message)) {
        return { status: 'unsupported', message: 'لم يتم منح إذن التخزين. يمكنك المشاركة بدلًا من الحفظ.' };
      }
    }
  }
  downloadBlob(blob, filename);
  return { status: 'downloaded', message: 'تم تنزيل الصورة.' };
}

export async function copyImage(blob: Blob): Promise<ShareOutcome> {
  try {
    const ClipboardItemCtor = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
    if (!ClipboardItemCtor || !navigator.clipboard?.write) throw new Error('unsupported');
    await navigator.clipboard.write([new ClipboardItemCtor({ [blob.type || 'image/png']: blob })]);
    return { status: 'copied', message: 'تم نسخ الصورة.' };
  } catch {
    return { status: 'unsupported', message: 'نسخ الصور غير مدعوم هنا — استخدم «حفظ» أو «مشاركة».' };
  }
}
