const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;
const QURANIC_ANNOTATION = /[\u06DD\u08E3-\u08FF\uFEFF]/g;

export function stripArabicDiacritics(input: string): string {
  return input.replace(DIACRITICS, '').replace(TATWEEL, '');
}

export function stripQuranicAnnotations(input: string): string {
  return stripArabicDiacritics(input).replace(QURANIC_ANNOTATION, '');
}

/**
 * تطبيع عربي للبحث: يزيل التشكيل والعلامات القرآنية، ويوحّد الهمزات والألفات
 * والتاء المربوطة والياء، ويحوّل الأرقام العربية-الهندية إلى لاتينية.
 */
export function normalizeArabic(input: string): string {
  return stripQuranicAnnotations(input)
    .replace(/[\u0622\u0623\u0625\u0627\u0671]/g, 'ا')
    .replace(/\u0649/g, 'ي')
    .replace(/\u0624/g, 'و')
    .replace(/\u0626/g, 'ي')
    .replace(/\u0629/g, 'ه')
    .replace(/[\u0660-\u0669]/g, (digit) => String('\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'.indexOf(digit)))
    .replace(/[\u06F0-\u06F9]/g, (digit) => String('\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9'.indexOf(digit)))
    .replace(/[^\p{Letter}\p{Number}\s:]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * صور التطبيع العربية الممكنة. الرسم العثماني يكتب الألف الخنجرية (U+0670) في كلمات مثل
 * «ٱلصَّٰبِرِين» و«ٱلرَّحْمَٰن»، وحذفها يعطي «الصبرين» وهي لا تطابق «الصابرين».
 * لذلك نُنتج صيغتين: واحدة بحذف العلامة وأخرى بتحويلها إلى ألف، ونبحث في الاثنتين.
 */
export function normalizeArabicVariants(input: string): string[] {
  const base = normalizeArabic(input);
  const withAlif = normalizeArabic(input.replace(/\u0670/g, '\u0627'));
  return base === withAlif ? [base] : [base, withAlif];
}

export function tokenizeArabic(input: string): string[] {
  return normalizeArabic(input).split(' ').filter(Boolean);
}

/**
 * يزيل «ال» التعريف من بداية الكلمة لمطابقة أوسع («الصبر» و«صبر»).
 * لا يعيد كلمة فارغة أبدًا.
 */
export function stripDefiniteArticle(token: string): string {
  if (token.length > 3 && token.startsWith('ال')) return token.slice(2);
  return token;
}

export function formatArabicNumber(value: number | string): string {
  return new Intl.NumberFormat('ar-EG', { useGrouping: false, numberingSystem: 'arab' }).format(Number(value));
}

export function toLatinDigits(input: string): string {
  return input
    .replace(/[\u0660-\u0669]/g, (digit) => String('\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'.indexOf(digit)))
    .replace(/[\u06F0-\u06F9]/g, (digit) => String('\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9'.indexOf(digit)));
}

/** تنسيق ساعة HH:mm بالمنطقة الزمنية للمدينة المختارة (لا بمنطقة الجهاز). */
export function formatClock(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone
  }).format(date);
}

/** التاريخ الميلادي بالعربية (اختياريًا بمنطقة زمنية محددة). */
export function formatGregorianDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone
  }).format(date);
}

/** التاريخ الهجري (أم القرى) مع إمكانية إزاحة يدوية ± أيام. */
export function formatHijriDate(date: Date, timeZone?: string, offsetDays = 0): string {
  const target = offsetDays ? new Date(date.getTime() + offsetDays * 86_400_000) : date;
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone
    }).format(target);
  } catch {
    return new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(target);
  }
}

export function formatDuration(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

/** مدة مختصرة للمشغل: 3:05 أو 1:12:30 */
export function formatPlaybackTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** يبني مقاطع النص مع تمييز الكلمات المطابقة للبحث. */
export function highlightMatches(text: string, query: string): Array<{ text: string; match: boolean }> {
  const needle = normalizeArabic(query);
  if (!needle) return [{ text, match: false }];
  const tokens = needle.split(' ').filter((token) => token.length >= 2);
  if (!tokens.length) return [{ text, match: false }];

  const words = text.split(/(\s+)/);
  return words.map((word) => {
    const normalizedWord = normalizeArabic(word);
    if (!normalizedWord) return { text: word, match: false };
    const isMatch = tokens.some((token) => normalizedWord.includes(token) || token.includes(normalizedWord));
    return { text: word, match: isMatch };
  });
}

export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return `${input.slice(0, maxLength - 1).trimEnd()}…`;
}
