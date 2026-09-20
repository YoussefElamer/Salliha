import type { Reciter } from '../core/types';

export const reciters: Reciter[] = [
  {
    id: 'ar.alafasy',
    name: 'مشاري راشد العفاسي',
    source: 'AlQuran.cloud / Islamic Network CDN',
    licenseNote: 'تلاوة عبر البث من CDN حسب شروط AlQuran.cloud؛ لا يعاد توزيع الملفات داخل الحزمة.',
    editionIdentifier: 'ar.alafasy',
    streamingOnly: false
  },
  {
    id: 'ar.abdulbasitmurattal',
    name: 'عبد الباسط عبد الصمد — مرتل',
    source: 'AlQuran.cloud / Islamic Network CDN',
    licenseNote: 'بث مباشر أو حفظ محلي شخصي عبر Download Manager داخل الجهاز إن سمح المتصفح.',
    editionIdentifier: 'ar.abdulbasitmurattal',
    streamingOnly: false
  },
  {
    id: 'ar.husary',
    name: 'محمود خليل الحصري',
    source: 'AlQuran.cloud / Islamic Network CDN',
    licenseNote: 'بث مباشر أو حفظ محلي شخصي عبر Download Manager داخل الجهاز إن سمح المتصفح.',
    editionIdentifier: 'ar.husary',
    streamingOnly: false
  }
];

export function getReciter(id: string): Reciter {
  return reciters.find((reciter) => reciter.id === id) ?? reciters[0];
}

export function ayahAudioUrl(reciterId: string, globalAyahNumber: number): string {
  return `https://cdn.islamic.network/quran/audio/128/${reciterId}/${globalAyahNumber}.mp3`;
}
