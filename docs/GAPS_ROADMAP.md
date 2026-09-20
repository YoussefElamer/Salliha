# خارطة إغلاق الفجوات — Salliha

> رد على المراجعة الميدانية بتاريخ 2026-09-21. التقييم العام: **Foundation قوي + Features أساسية ≠ نسخة نهائية**. هذه الخطة تحوّل كل فجوة إلى Task قابلة للتنفيذ والاختبار.

## الملخص التنفيذي

| الجزء | الحالة الحالية | المطلوب للاكتمال | الأولوية |
|-------|---------------|------------------|----------|
| Architecture | 🟢 قوي | حافظ + وثّق | P3 |
| Quran pipeline + validation | 🟢 قوي جدًا | حافظ، لا تلمس النص، وثّق provenance | P0 (حماية) |
| Quran search | 🟢 موجود | أضف اختبارات عربية + Voice | P2 |
| Long press | 🟢 موجود (420ms) | اختبارات UI | P1 |
| Prayer calculation | 🟢 موجود | اختبارات مرجعية بمدن/تواريخ، اختبار DST | P0 |
| Notifications / Adhan | 🟡 Browser فقط | Native scheduled Adhan (Capacitor) | **P0** |
| Audio | 🟡 State فقط | توثيق ترخيص + اختبار خلفية + Cache | P1 |
| Tafsir | 🟡 Repository فقط | بيانات + cache + اختبارات + إسناد | P1 |
| Adhkar | 🟢 Pipeline موجود | اختبارات بيانات دينية | P1 |
| Offline/Downloads | 🟢 أساس موجود | Download Manager فعلي + اختبارات | P1 |
| الحفظ والمراجعة | 🔴 غير مكتمل | Module مستقل | **P0** |
| إحصائيات المستخدم | 🔴 غير مكتملة | Module مستقل | P2 |
| Voice Search | 🔴 غير موجود | Web Speech API + fallback | P2 |
| Share Image | 🟡 موجود | اختبار rendering | P2 |
| اختبارات شاملة | 🟡 جزئية | تغطية لكل Feature | P1 |

---

## الفلسفة الحاكمة

1. **لا يُستخدم AI كمصدر للنص الديني.** القرآن/الأذكار/التفسير تُنسخ حرفيًا من مصدر موثق + SHA-256 + validation يوقف البناء عند أي تحريف.
2. **الـValidator يثبت المطابقة للمصدر، لا تفوّق المصدر.** لذلك نوثق provenance + license في `docs/DATA_SOURCES.md` ولا ندّعي "ضمانًا دينيًا مطلقًا".
3. **PWA لا يضمن Exact Alarms.** أي ميزة أذان يجب أن تصرّح بقيود النظام ولا تعد بما لا تستطيع ضمانه.

---

## Phase 0 — توثيق (تم)

- هذا الملف.
- تحديث `DATA_SOURCES.md` و `QURAN_VALIDATION.md` موجودان.
- لا مساس بـ `data/sources/quran` إلا بتوثيق + hash جديد + مراجعة بشرية.

## Phase 1 — التحصين والاختبارات الحرجة (Sprint 1 — أسبوع)

### 1.1 Prayer — اختبارات مرجعية
**المشكلة الآن:** اختبار `times are sorted` لا يثبت صحة الساعة.
**الحل:**
- `tests/prayer-reference.test.ts` يقارن حساب `calculatePrayerTimes` مع جدول مرجعي مستقل لثلاث مدن (مكة، القاهرة، لندن) وتاريخين (شتاء/صيف) بهامش ±2 دقيقة.
- اختبار DST منفصل لـ Europe/London.
- Golden snapshot لمكة 2026-09-20 يمنع انحراف غير مقصود.
- يعمل في CI بدون شبكة.

### 1.2 اختبارات البيانات الدينية
- `tests/adhkar.test.ts`: يتحقق أن `adhkar.generated.json` مطابق للمصدر + عدد العناصر + بنية الحقول + categories.
- `tests/tafsir.test.ts`: يختبر `TafsirRepository` مع mock لـ `fetch` (نجاح/فشل/Offline) ويتحقق من `sourceName` و `sourceUrl`.

### 1.3 Quran UI
- `tests/quran-ui.test.tsx`: اختبار `QuranPage` + `VerseActionSheet`:
  - RTL + dark mode (موجود)
  - Long press 420ms يفتح الـSheet
  - contextMenu يفتح الـSheet
  - أزرار Sheet (نسخ، مشاركة، تفسير) موجودة
  - Font scale clamp

### 1.4 Share Image
- `tests/shareCard.test.ts`: يختبر `createAyahShareCard` في jsdom + canvas mock يتحقق من الأبعاد 1080×1350 وأن Blob يُنتج.

## Phase 2 — الأذان الحقيقي في الخلفية (Sprint 2 — أسبوعان)

**الوضع الحالي:** `BrowserNotificationService` فقط (Permission + showNotification).

**المطلوب Native:**

```
src/notifications/
  NotificationService.ts      // موجود — browser
  NativeAdhanService.ts       // جديد — Capacitor Local Notifications
  adhanScheduler.ts           // جديد — جدولة 5 صلوات + pre-prayer
```

**التصميم المقترح:**

```ts
interface AdhanScheduler {
  scheduleDaily(times: PrayerTime[]): Promise<void>
  cancelAll(): Promise<void>
  getPending(): Promise<PendingNotification[]>
}
```

- يستخدم `@capacitor/local-notifications` (تُضاف للـpackage.json).
- على Android: يطلب `display` + يوضح أن `exact alarms` قد تُمنع بسبب Battery Optimization — يرشد المستخدم للإعدادات.
- على iOS: يوضح حدود 64 notification + عدم ضمان الدقة في الخلفية.
- على Web/PWA: يبقى fallback الحالي ويعرض رسالة: "التنبيهات الدقيقة في الخلفية تعتمد على النظام".
- كل صلاة تُجدول مرتين: `prePrayerMinutes` ووقت الأذان نفسه.
- `silentMode` + `vibration` + `adhanEnabled` per-prayer.
- اختبار: `tests/native-adhan.test.ts` يmock Capacitor ويتحقق من الجدولة والإلغاء.

**ملاحظة مهمّة للمستخدم:** حتى بعد التنفيذ، لا يمكن ضمان Exact على كل أجهزة Android/iOS — التطبيق يصارح المستخدم ولا يدّعي تجاوز قيود النظام.

## Phase 3 — المحتوى الموثوق (Sprint 2-3)

### 3.1 Tafsir
- الحالي: `AlQuranCloudTafsirRepository` يجلب `ar.muyassar` عند الطلب.
- التحسين: إضافة `CachedTafsirRepository` decorator يحفظ في `localStorage`/`Cache API` مع TTL 30 يوم + مصدر دائم في UI.
- لا نضمن Offline كامل حتى تُراجع رخصة إعادة التوزيع — نوضح ذلك في `DATA_SOURCES.md`.
- مقياس الاكتمال: 1 اختبار لكل آية من 6236 غير مطلوب؛ المطلوب أن Repository يجلب بنجاح + يعرض المصدر + يفشل بوضوح Offline.

### 3.2 Audio / Reciters
- الحالي: `reciters.ts` + `audioPlayer.ts` + `AudioProvider` (state).
- النواقص: إثبات ترخيص + تشغيل خلفية + Download.
- الحل:
  - توثيق CDN وشروط `alquran.cloud/terms` في `DATA_SOURCES.md` (موجود).
  - `DownloadRepository.cacheSurah` موجود ويستخدم Cache API — نحتاج اختبارات `tests/download.test.ts` تmock Cache.
  - Audio background: على Web يعتمد على Media Session API، على Native يعتمد على Capacitor Background Mode (اختياري مستقبلاً).
  - لا نعيد استضافة ملفات صوتية داخل الريبو.

### 3.3 Download Manager
- `src/downloads/DownloadRepository.ts` موجود ويطبق `Cache API` مع `onProgress`.
- النواقص: اختبار فعلي + UI للتحميل + معالجة CORS/مساحة.
- الحل: Page `DownloadsPage` تعرض `list()` + زر `delete` + شريط تقدم، مع رسائل خطأ واضحة.

## Phase 4 — الحفظ والإحصائيات (Sprint 3-4) — Gap 🔴

### 4.1 Hifz (الحفظ)
لم يكن هناك module مستقل. المقترح:

```
src/hifz/
  HifzRepository.ts      // CRUD لخطط الحفظ
  HifzPage.tsx           // واجهة
  types.ts
```

- `HifzPlan`: { id, surahId, fromAyah, toAyah, dailyGoal, streak, createdAt }
- `HifzProgress`: { planId, date, completedAyat, reviewed }
- `HifzReviewQueue`: آيات تحتاج مراجعة (SM-2 مبسط).
- اختبارات: `tests/hifz.test.ts` يختبر إنشاء خطة، إكمال يوم، streak، وطابور المراجعة.

### 4.2 Stats
```
src/stats/
  StatsRepository.ts
  StatsPage.tsx
```

- يقرأ من `BookmarkRepository` + `HifzRepository` + `PrayerRepository` + `Adhkar`.
- يعرض: آيات مقروءة هذا الأسبوع، streak الحفظ، صلوات منبهة، أذكار مُنجزة.
- كل البيانات local فقط — لا باك-إند.
- اختبار: `tests/stats.test.ts`.

## Phase 5 — البحث والمشاركة (Sprint 4)

### 5.1 Voice Search
- ليس موجودًا — نضيف `src/search/voiceSearch.ts`:
  - يستخدم `webkitSpeechRecognition` / `SpeechRecognition` إن وُجد، وإلا يعرض fallback نصي.
  - يدعم `ar-SA` أولاً ثم `en-US`.
  - النتيجة تُمرر لنفس `QuranRepository.search` بعد `normalizeArabic`.
  - اختبار: `tests/voice-search.test.ts` يmock recognition.

### 5.2 Share Image
- `src/sharing/shareCard.ts` موجود (1080×1350, Canvas, light/dark).
- المطلوب: اختبار rendering فعلي + دعم خط عربي جميل + اختبار تنزيل الملف.
- إضافة زر "نسخ الصورة" عبر `ClipboardItem` إن توفر.

## Phase 6 — التقفيل والإطلاق

- `npm run validate:quran` + `validate:data` + `lint` + `test` يجب أن تمر.
- `npm run cap:android` واختبار فعلي على جهاز/محاكي لـ Adhan.
- تحديث `docs/RELEASE.md` بخطوات الإطلاق.
- لا نمنح Project Rating رقمي؛ نعرض جدول المكونات (أخضر/أصفر/أحمر) كما في المراجعة.

---

## معايير القبول (Definition of Done) لكل Phase

- كود + اختبارات + توثيق مصدر/ترخيص.
- لا تعديل لنص قرآني إلا عبر pipeline الموثق.
- كل Feature جديدة لها `Repository` + `test` + رسالة Offline واضحة.
- لا ادعاءات عن Native Adhan مضمونة — رسائل صريحة عن قيود النظام.

---

## تسلسل التنفيذ المقترح (مباشر بعد هذه الخطة)

1. **الآن:** إضافة اختبارات Phase 1 (prayer-reference, adhkar, tafsir, quran-ui, shareCard) — بدون كسر CI.
2. **التالي:** NativeAdhanService + Capacitor plugin + جدولة.
3. **ثم:** Hifz + Stats.
4. **أخيرًا:** Voice Search + تحسين Share.

> هذه الخطة هي الأساس لـ Pull Request القادم. كل Phase تُنفذ في commit منفصل مع `npm test` أخضر.
