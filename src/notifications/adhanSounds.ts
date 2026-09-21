/**
 * سجل أصوات الأذان — ملفات صوتية مدمجة داخل التطبيق (مجلد resources/sounds
 * يُنسخ إلى public/sounds للويب وإلى res/raw على أندرويد).
 *
 * مصدر الملفات: مستودع mohsalvi/adhan-audio على GitHub — توزيع مجاني للاستخدام الشخصي.
 */
export interface AdhanSound {
  id: string;
  name: string;
  /** المسار على الويب/التطبيق المتصفح. فارغ = نغمة مدمجة بلا ملف. */
  file: string | null;
  /** اسم المورد داخل أندرويد (res/raw) لإشعارات النظام. */
  rawName: string | null;
}

export const adhanSounds: AdhanSound[] = [
  { id: 'adhan-misr', name: 'أذان مصري تقليدي', file: '/sounds/adhan-misr.mp3', rawName: 'adhan_misr' },
  { id: 'adhan-makkah', name: 'أذان الحرم المكي', file: '/sounds/adhan-makkah.mp3', rawName: 'adhan_makkah' },
  { id: 'adhan-madinah', name: 'أذان المسجد النبوي', file: '/sounds/adhan-madinah.mp3', rawName: 'adhan_madinah' },
  { id: 'adhan-alafasy', name: 'أذان — مشاري العفاسي', file: '/sounds/adhan-alafasy.mp3', rawName: 'adhan_alafasy' },
  { id: 'chime', name: 'نغمة تنبيه هادئة (بدون أذان)', file: null, rawName: null }
];

export function getAdhanSound(id: string): AdhanSound {
  return adhanSounds.find((sound) => sound.id === id) ?? adhanSounds[0];
}

let currentAudio: HTMLAudioElement | null = null;

/** يشغّل صوت الأذان المختار الآن (للاختبار أو للتشغيل داخل التطبيق). */
export async function playAdhanSound(id: string): Promise<void> {
  const sound = getAdhanSound(id);
  if (sound.file && typeof Audio !== 'undefined') {
    try {
      currentAudio?.pause();
      currentAudio = new Audio(sound.file);
      currentAudio.preload = 'auto';
      await currentAudio.play();
      return;
    } catch {
      // الملف غير متاح بعد — نغمة مدمجة أفضل من الصمت.
    }
  }
  playBuiltInChime();
}

export function stopAdhanSound(): void {
  currentAudio?.pause();
  currentAudio = null;
}

/** نغمة تنبيه مدمجة مولّدة بـ WebAudio — تعمل بدون أي ملفات خارجية. */
export function playBuiltInChime(): void {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    const ctx = new Ctor();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const start = ctx.currentTime + index * 0.3;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.6);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 1.7);
    });
    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 4500);
  } catch {
    // لا صوت متاح على هذا الجهاز.
  }
}

/** يشغّل صوت تذكير الصلاة على النبي ﷺ، مع نغمة بديلة إن لم يتوفر الملف. */
export async function playSalawatSound(): Promise<void> {
  if (typeof Audio === 'undefined') {
    playBuiltInChime();
    return;
  }
  try {
    const audio = new Audio('/sounds/salawat.mp3');
    audio.preload = 'auto';
    await audio.play();
  } catch {
    playBuiltInChime();
  }
}

/** يرسل إشعارًا تجريبيًا (يطلب الإذن أولًا إن لزم) ويعيد رسالة بالنتيجة. */
export async function sendTestNotification(): Promise<string> {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') {
        return 'لم يُمنح إذن الإشعارات. اسمح بالإشعارات من المتصفح ثم جرّب مرة أخرى.';
      }
      new Notification('صليها — إشعار تجريبي', {
        body: 'لو وصلك هذا الإشعار فالتنبيهات تعمل بنجاح إن شاء الله.',
        dir: 'rtl',
        lang: 'ar',
        icon: '/icons/icon-192.png'
      });
      return 'تم إرسال إشعار تجريبي — تحقق من شريط الإشعارات.';
    }
    const mod = await import('@capacitor/local-notifications');
    await mod.LocalNotifications.requestPermissions();
    await mod.LocalNotifications.schedule({
      notifications: [
        {
          title: 'صليها — إشعار تجريبي',
          body: 'لو وصلك هذا الإشعار فالتنبيهات تعمل بنجاح إن شاء الله.',
          id: 999_991,
          schedule: { at: new Date(Date.now() + 1200) }
        }
      ]
    });
    return 'تمت جدولة إشعار تجريبي عبر النظام — سيظهر خلال لحظات.';
  } catch {
    return 'تعذر إرسال إشعار تجريبي على هذا الجهاز.';
  }
}
