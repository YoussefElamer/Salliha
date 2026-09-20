# Architecture — صَلِّها

التطبيق مبني كـ PWA باستخدام React + TypeScript + Vite، مع تصميم Offline-first قدر الإمكان. ولإنتاج Android/iOS يستخدم المشروع Capacitor كـ Native Shell حول نفس Build المتحقق منه.

## التقسيم

```text
src/
  app/            Navigation و Shell
  home/           Dashboard
  prayer/         حساب مواقيت الصلاة والإعدادات
  quran/          المصحف، البحث القرآني، Bottom Sheet
  audio/          مشغل القرآن والقراء
  tafsir/         Repository لجلب التفسير من مصدر موثق
  adhkar/         الأذكار والعداد
  bookmarks/      العلامات وآخر موضع قراءة
  search/         البحث العام
  notifications/  إشعارات المتصفح/النظام
  downloads/      Download Manager عبر Cache API
  sharing/        مولد صور الآيات عبر Canvas
  settings/       الإعدادات والنسخ الاحتياطي المحلي
  core/           الأنواع، التخزين، أدوات العربية
  data/           البيانات المولدة من مصادر موثقة
```

## طبقة البيانات

واجهات Repository موجودة بحيث يمكن تغيير المصدر لاحقًا دون إعادة كتابة الواجهة:

- `QuranRepository`
- `TafsirRepository`
- `PrayerRepository`
- `AdhkarRepository`
- `BookmarkRepository`
- `SettingsRepository`
- `DownloadRepository`

## Offline-first

يعمل Offline:

- المصحف الكامل.
- البحث في القرآن.
- العلامات وآخر موضع.
- الإعدادات.
- أذكار الصباح والمساء المضمنة.
- مواقيت الصلاة بالحساب المحلي.
- التلاوات التي تم حفظها في Cache الجهاز.

يعتمد على الإنترنت:

- جلب التفسير من API.
- بث التلاوات غير المحملة.
- أول تحميل للتطبيق قبل تثبيت Service Worker.

## الخصوصية

لا يوجد Backend خاص بالتطبيق في هذه النسخة. البيانات الشخصية تبقى في `localStorage` أو Cache المتصفح. الموقع لا يطلب إلا عند ضغط المستخدم على زر استخدام الموقع.

## قيود المنصات

- PWA لا يستطيع ضمان Exact Alarms مثل تطبيق Native على كل الأنظمة.
- تشغيل الأذان في الخلفية يتبع قيود المتصفح/النظام.
- التطبيق يعرض ذلك بوضوح ولا يدّعي تجاوز القيود.
