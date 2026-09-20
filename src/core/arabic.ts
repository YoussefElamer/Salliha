const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;

export function stripArabicDiacritics(input: string): string {
  return input.replace(DIACRITICS, '').replace(TATWEEL, '');
}

export function normalizeArabic(input: string): string {
  return stripArabicDiacritics(input)
    .replace(/[إأٱآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[^\p{Letter}\p{Number}\s:]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function tokenizeArabic(input: string): string[] {
  return normalizeArabic(input).split(' ').filter(Boolean);
}

export function formatArabicNumber(value: number | string): string {
  return new Intl.NumberFormat('ar', { useGrouping: false }).format(Number(value));
}

export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

export function formatDuration(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}
