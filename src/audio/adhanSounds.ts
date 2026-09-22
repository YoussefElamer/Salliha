import sounds from './adhan-sounds.json';

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

export const adhanSounds: AdhanSound[] = sounds.map((item) => ({
  id: item.id,
  name: item.name,
  nameEn: item.nameEn,
  normalUrl: raw(item.normal),
  fajrUrl: raw(item.fajr),
  normalFile: item.normalFile,
  fajrFile: item.fajrFile,
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
