export interface AdhanSound {
  id: string;
  name: string;
  nameEn: string;
  normalUrl: string;
  fajrUrl: string;
  normalFile: string;
  fajrFile: string;
  source: string;
  licenseNote: string;
}

const RAW = 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/';
const source = 'Kiwifu/adhan-mp3 — ملفات أذان من AlAdhan';
const licenseNote = 'المصدر يصف الملفات بأنها مجانية للتطبيقات الإسلامية وبرامج مواقيت الصلاة؛ راجع المصدر وشروطه قبل أي توزيع تجاري.';

function raw(file: string): string {
  return RAW + encodeURIComponent(file).replace(/%2F/g, '/').replace(/%28/g, '(').replace(/%29/g, ')');
}

const sounds = [
  {
    id: 'abdulbasit-egypt',
    name: 'عبد الباسط — مصر',
    nameEn: 'Abdulbasit — Egypt',
    normal: 'Abdulbasit_Abdusamad_1_-_Egypt_(عبد_الباسط_عبد_الصمد_-_مصر).mp3',
    fajr: 'Abdulbasit_Abdusamad_6_-_Fajr_Egypt_(عبد_الباسط_عبد_الصمد_-_فجر_مصر).mp3'
  },
  {
    id: 'ahmad-nuinaa-egypt',
    name: 'أحمد نعينع — مصر',
    nameEn: 'Ahmed Nuinaa — Egypt',
    normal: 'Ahmed_Nuinaa_1_-_Egypt_(أحمد_نعينع_-_مصر).mp3',
    fajr: 'Adhan_Fajr_Cairo_Egypt_(أذان_الفجر_القاهرة_مصر).mp3'
  },
  {
    id: 'haram-makki',
    name: 'الحرم المكي',
    nameEn: 'Al-Haram Al-Makki',
    normal: 'Adhan_Fajr_Al_Haram_Al_Maki_(أذان_الفجر_الحرم_المكي).mp3',
    fajr: 'Adhan_Fajr_Al_Haram_Al_Maki_(أذان_الفجر_الحرم_المكي).mp3'
  },
  {
    id: 'haram-madani',
    name: 'الحرم المدني',
    nameEn: 'Al-Haram Al-Madani',
    normal: 'Adhan_Al_Haram_Al_Madani_-_Al_Madinah_1_(أذان_الحرم_المدني_-_المدينة_المنورة).mp3',
    fajr: 'Adhan_Fajr_Al_Haram_Al_Madani_(أذان_الفجر_الحرم_المدني).mp3'
  },
  {
    id: 'makkah',
    name: 'أذان مكة',
    nameEn: 'Makkah Adhan',
    normal: 'Adhan_Al_Haram_Al_Maki_(أذان_الحرم_المكي).mp3',
    fajr: 'Adhan_Fajr_Al_Haram_Al_Maki_(أذان_الفجر_الحرم_المكي).mp3'
  },
  {
    id: 'riyadh',
    name: 'أذان الرياض',
    nameEn: 'Riyadh Adhan',
    normal: 'Adhan_Riyadh_Saudi_Arabia_(أذان_الرياض_السعودية).mp3',
    fajr: 'Adhan_Fajr_Al_Haram_Al_Maki_(أذان_الفجر_الحرم_المكي).mp3'
  }
] as const;

export const adhanSounds: AdhanSound[] = sounds.map((item) => ({
  id: item.id,
  name: item.name,
  nameEn: item.nameEn,
  normalUrl: raw(item.normal),
  fajrUrl: raw(item.fajr),
  normalFile: `adhan_${item.id}.mp3`,
  fajrFile: `adhan_${item.id}_fajr.mp3`,
  source,
  licenseNote
}));

export const DEFAULT_ADHAN_SOUND_ID = 'abdulbasit-egypt';

export function getAdhanSound(id?: string): AdhanSound {
  return adhanSounds.find((sound) => sound.id === id) ?? adhanSounds[0];
}

export function getAdhanSoundForPrayer(id: string, prayerName: string): string {
  const sound = getAdhanSound(id);
  return prayerName === 'الفجر' ? sound.fajrFile : sound.normalFile;
}

export function getAdhanPreviewUrl(id: string, prayerName: string): string {
  const sound = getAdhanSound(id);
  return prayerName === 'الفجر' ? sound.fajrUrl : sound.normalUrl;
}
