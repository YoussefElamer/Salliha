import type { Reciter } from '../core/types';
import { normalizeArabic } from '../core/arabic';

const CDN = 'https://cdn.islamic.network/quran';
const source = 'AlQuran.cloud / Islamic Network CDN';
const licenseNote = 'بث مباشر أو تخزين مؤقت على الجهاز للاستخدام الشخصي وفق شروط AlQuran.cloud؛ لا يعاد توزيع الملفات داخل الحزمة.';

function make(
  id: string,
  name: string,
  description: string,
  style: Reciter['style'],
  options: { surahAudio?: boolean; bitrates?: number[]; country?: string } = {}
): Reciter {
  return {
    id,
    name,
    description,
    source,
    licenseNote,
    editionIdentifier: id,
    streamingOnly: false,
    style,
    surahAudio: options.surahAudio ?? true,
    bitrates: options.bitrates ?? [128, 64],
    country: options.country
  };
}

export const reciters: Reciter[] = [
  make('ar.alafasy', 'مشاري راشد العفاسي', 'تلاوة مرتلة مشهورة — صوت واضح مناسب للحفظ', 'murattal', { country: 'الكويت' }),
  make('ar.abdulbasitmurattal', 'عبد الباسط عبد الصمد (مرتل)', 'قارئ التلاوة المصرية الأشهر', 'murattal', { country: 'مصر' }),
  make('ar.abdulbasitmujawwad', 'عبد الباسط عبد الصمد (مجوّد)', 'ترتيل مجوّد بتجويد مدرسي كامل', 'mujawwad', { country: 'مصر', bitrates: [128] }),
  make('ar.husary', 'محمود خليل الحصري', 'التسجيل التعليمي الأشهر — أداء متزن', 'murattal', { country: 'مصر' }),
  make('ar.husarymujawwad', 'محمود خليل الحصري (مجوّد)', 'تلاوة مجوّدة بتشكيل التجويد', 'mujawwad', { country: 'مصر', bitrates: [128] }),
  make('ar.minshawi', 'محمد صديق المنشاوي', 'تلاوة خاشعة مرتلة', 'murattal', { country: 'مصر' }),
  make('ar.minshawimujawwad', 'محمد صديق المنشاوي (مجوّد)', 'تلاوة مجوّدة خاشعة', 'mujawwad', { country: 'مصر', bitrates: [128] }),
  make('ar.abdurrahmaansudais', 'عبد الرحمن السديس', 'إمام الحرم المكي', 'murattal', { country: 'السعودية' }),
  make('ar.mahermuaiqly', 'ماهر المعيقلي', 'إمام الحرم المكي — تلاوة هادئة', 'murattal', { country: 'السعودية' }),
  make('ar.saoodshuraym', 'سعود الشريم', 'إمام الحرم المكي', 'murattal', { country: 'السعودية' }),
  make('ar.muhammadayyoub', 'محمد أيوب', 'إمام المسجد النبوي', 'murattal', { country: 'السعودية' }),
  make('ar.muhammadjibreel', 'محمد جبريل', 'تلاوة مصرية كلاسيكية', 'murattal', { country: 'مصر' }),
  make('ar.shaatree', 'أبو بكر الشاطري', 'تلاوة مرتلة هادئة', 'murattal', { country: 'السعودية' }),
  make('ar.ahmedajamy', 'أحمد بن علي العجمي', 'تلاوة مؤثرة', 'murattal', { country: 'السعودية' }),
  make('ar.hanirifai', 'هاني الرفاعي', 'إمام الحرم المكي — تلاوة مرتلة', 'murattal', { country: 'السعودية' }),
  make('ar.hudhaify', 'علي بن عبد الرحمن الحذيفي', 'إمام المسجد النبوي', 'murattal', { country: 'السعودية' }),
  make('ar.ibrahimakhbar', 'إبراهيم الأخضر', 'إمام المسجد النبوي — تلاوة مرتلة', 'murattal', { country: 'السعودية' }),
  make('ar.abdullahbasfar', 'عبد الله بصفر', 'قارئ مكي معروف', 'murattal', { country: 'السعودية' }),
  make('ar.aymanswoaid', 'أيمن سويد', 'تلاوة تعليمية لأحكام التجويد', 'teaching', { country: 'سوريا', surahAudio: false, bitrates: [128] }),
  make('ar.muhammadalminshawi', 'محمد المنشاوي — مرتل', 'اسم بديل لتسجيل المنشاوي المرتل', 'murattal', { country: 'مصر', surahAudio: false, bitrates: [128] })
];

export function getReciter(id: string): Reciter {
  return reciters.find((reciter) => reciter.id === id) ?? reciters[0];
}

export function filterReciters(query: string): Reciter[] {
  const normalized = normalizeArabic(query);
  if (!normalized) return reciters;
  return reciters.filter((reciter) => normalizeArabic(`${reciter.name} ${reciter.country ?? ''} ${reciter.style}`).includes(normalized));
}

/** رابط تلاوة الآية (يُستخدم في وضع «آية بآية»). */
export function ayahAudioUrl(reciterId: string, globalAyahNumber: number, bitrate = 128): string {
  return `${CDN}/audio/${bitrate}/${reciterId}/${globalAyahNumber}.mp3`;
}

/** رابط السورة كاملة (ملف واحد) — متاح لمعظم القراء على نفس الـCDN. */
export function surahAudioUrl(reciterId: string, surahId: number, bitrate = 128): string {
  return `${CDN}/audio-surah/${bitrate}/${reciterId}/${surahId}.mp3`;
}
