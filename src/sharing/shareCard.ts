import type { AdhkarItem, Ayah } from '../core/types';

export type ShareTheme = 'light' | 'dark';

export interface ShareCardOptions {
  theme?: ShareTheme;
  /** نوع البطاقة: آية قرآنية أو ذكر/دعاء. */
  kind?: 'ayah' | 'adhkar';
  brandName?: string;
  /** إظهار اسم القارئ أسفل البطاقة. */
  footerNote?: string;
  width?: number;
  height?: number;
}

const BRAND = 'صليها — Salliha';

/** ينتظر تحميل الخطوط حتى لا تُرسم الحروف بأشكال ناقصة (المشكلة الشائعة في WebView). */
export async function ensureShareFonts(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  const specs = ['400 64px "Amiri Quran"', '400 40px "Cairo Variable"', '700 40px "Cairo Variable"', '600 32px "Noto Naskh Arabic"'];
  await Promise.all(
    specs.map(async (spec) => {
      try {
        await fonts.load(spec);
      } catch {
        // خط غير متاح — نكمل بالخط الاحتياطي.
      }
    })
  );
  try {
    await fonts.ready;
  } catch {
    // تجاهل.
  }
}

interface DrawInput {
  text: string;
  reference: string;
  theme: ShareTheme;
  kind: 'ayah' | 'adhkar';
  footerNote?: string;
  width: number;
  height: number;
  /** عدد الأسطر المتوقعة لحساب الحجم تلقائيًا. */
  charCount: number;
}

function palette(theme: ShareTheme) {
  return theme === 'dark'
    ? { bg: '#0d1715', bgAlt: '#13231f', text: '#f7f1e3', muted: '#aabdb7', accent: '#d1b36d', primary: '#58bba9', frame: 'rgba(209,179,109,0.55)' }
    : { bg: '#f6f2e9', bgAlt: '#fffdf7', text: '#17231f', muted: '#5d6f69', accent: '#b9903f', primary: '#1f6f62', frame: 'rgba(31,111,98,0.35)' };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function draw(input: DrawInput): HTMLCanvasElement {
  const { width, height, theme, kind, footerNote } = input;
  const colors = palette(theme);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas غير مدعوم على هذا الجهاز.');
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // الخلفية
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, theme === 'dark' ? 'rgba(88,187,169,0.16)' : 'rgba(31,111,98,0.10)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // إطار مزخرف
  const margin = Math.round(width * 0.045);
  ctx.strokeStyle = colors.frame;
  ctx.lineWidth = Math.max(3, width * 0.004);
  const radius = width * 0.05;
  roundRect(ctx, margin, margin, width - margin * 2, height - margin * 2, radius);
  ctx.stroke();
  ctx.strokeStyle = theme === 'dark' ? 'rgba(209,179,109,0.22)' : 'rgba(31,111,98,0.18)';
  ctx.lineWidth = Math.max(2, width * 0.002);
  roundRect(ctx, margin * 1.6, margin * 1.6, width - margin * 3.2, height - margin * 3.2, radius * 0.8);
  ctx.stroke();

  // شريط علوي
  const topBar = margin * 2.6;
  ctx.fillStyle = colors.primary;
  roundRect(ctx, width / 2 - width * 0.16, topBar - 10, width * 0.32, 6, 3);
  ctx.fill();

  // النص الرئيسي
  const maxWidth = width - margin * 4.4;
  const fontBase = kind === 'ayah' ? width * 0.066 : width * 0.055;
  let fontSize = fontBase;
  if (input.charCount > 260) fontSize = fontBase * 0.72;
  else if (input.charCount > 170) fontSize = fontBase * 0.82;
  else if (input.charCount > 110) fontSize = fontBase * 0.9;
  ctx.fillStyle = colors.text;
  ctx.font = `400 ${Math.round(fontSize)}px "Amiri Quran", "Noto Naskh Arabic", "Amiri", serif`;
  let lines = wrapText(ctx, input.text, maxWidth);
  let lineHeight = fontSize * 1.85;
  const availableHeight = height * 0.56;
  while (lines.length * lineHeight > availableHeight && fontSize > width * 0.026) {
    fontSize *= 0.92;
    ctx.font = `400 ${Math.round(fontSize)}px "Amiri Quran", "Noto Naskh Arabic", "Amiri", serif`;
    lines = wrapText(ctx, input.text, maxWidth);
    lineHeight = fontSize * 1.85;
  }
  const blockHeight = lines.length * lineHeight;
  const startY = Math.max(height * 0.3, (height - blockHeight) / 2 + lineHeight * 0.2);
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * lineHeight);
  });

  // المرجع (سورة/آية أو تصنيف الذكر)
  const referenceY = Math.max(startY + blockHeight + height * 0.06, height * 0.76);
  ctx.fillStyle = colors.accent;
  ctx.font = `700 ${Math.round(width * 0.036)}px "Cairo Variable", "Noto Naskh Arabic", sans-serif`;
  ctx.fillText(input.reference, width / 2, referenceY);

  if (footerNote) {
    ctx.fillStyle = colors.muted;
    ctx.font = `400 ${Math.round(width * 0.026)}px "Cairo Variable", sans-serif`;
    ctx.fillText(footerNote, width / 2, referenceY + width * 0.05);
  }

  // التوقيع
  ctx.fillStyle = colors.primary;
  ctx.font = `700 ${Math.round(width * 0.03)}px "Cairo Variable", "Noto Naskh Arabic", sans-serif`;
  ctx.fillText(BRAND, width / 2, height - margin * 2.5);
  ctx.fillStyle = colors.muted;
  ctx.font = `400 ${Math.round(width * 0.022)}px "Cairo Variable", sans-serif`;
  ctx.fillText('تطبيق قرآني مجاني بلا إعلانات', width / 2, height - margin * 1.6);

  return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('تعذر إنشاء الصورة.'))), 'image/png', 0.95);
  });
}

export async function createAyahShareCard(ayah: Ayah, theme: ShareTheme = 'light', options: ShareCardOptions = {}): Promise<Blob> {
  await ensureShareFonts();
  const width = options.width ?? 1080;
  const height = options.height ?? 1440;
  const canvas = draw({
    text: ayah.text,
    reference: `سورة ${ayah.surahName} — الآية ${new Intl.NumberFormat('ar-EG', { numberingSystem: 'arab' }).format(ayah.ayahNumber)}`,
    theme,
    kind: 'ayah',
    footerNote: options.footerNote,
    width,
    height,
    charCount: ayah.text.length
  });
  return toBlob(canvas);
}

export async function createAdhkarShareCard(item: AdhkarItem, theme: ShareTheme = 'light', options: ShareCardOptions = {}): Promise<Blob> {
  await ensureShareFonts();
  const width = options.width ?? 1080;
  const height = options.height ?? 1440;
  const canvas = draw({
    text: item.content,
    reference: item.categories[0] ?? 'ذكر',
    theme,
    kind: 'adhkar',
    footerNote: options.footerNote ?? (item.source ? `المصدر: ${item.source}` : undefined),
    width,
    height,
    charCount: item.content.length
  });
  return toBlob(canvas);
}

export function shareCardFilename(kind: 'ayah' | 'adhkar', identifier: string | number): string {
  return `salliha-${kind}-${identifier}.png`;
}
