import type { Ayah } from '../core/types';

export async function createAyahShareCard(ayah: Ayah, theme: 'light' | 'dark' = 'light'): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas غير مدعوم.');
  const bg = theme === 'dark' ? '#10231f' : '#f8f4ea';
  const fg = theme === 'dark' ? '#f7f1e3' : '#17231f';
  const accent = '#1f6f62';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 18, canvas.height);
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = fg;
  ctx.font = '700 58px serif';
  wrapText(ctx, ayah.text, 540, 410, 850, 92);
  ctx.font = '600 36px sans-serif';
  ctx.fillStyle = accent;
  ctx.fillText(`سورة ${ayah.surahName} — الآية ${ayah.ayahNumber}`, 540, 1050);
  ctx.font = '500 30px sans-serif';
  ctx.fillStyle = theme === 'dark' ? '#bcd7d1' : '#56746d';
  ctx.fillText('صَلِّها — Salliha', 540, 1210);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('تعذر إنشاء الصورة.'))), 'image/png', 0.95));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  lines.push(line);
  const start = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((current, index) => ctx.fillText(current, x, start + index * lineHeight));
}
