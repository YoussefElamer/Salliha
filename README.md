# صَلِّها — Salliha

تطبيق إسلامي مجاني بالكامل، بلا إعلانات، بلا اشتراكات، بلا مشتريات داخل التطبيق، يركز على:

- مواقيت الصلاة محليًا.
- المصحف كاملًا مع بحث سريع بدون تشكيل.
- التلاوة والقراء ومشغل قرآن.
- الأذكار والعداد.
- العلامات وآخر موضع قراءة.
- آية اليوم من قاعدة القرآن.
- Offline-first قدر الإمكان.
- خصوصية المستخدم.

> دقة القرآن أهم من أي ميزة. نص القرآن لا يكتبه AI ولا يصححه ولا يعيد صياغته. التطبيق يستخدم مصدرًا موثقًا ويشغّل `validate-quran` قبل البناء.

## التشغيل

```bash
npm install
npm run data:build
npm run validate:quran
npm run test
npm run dev
```

## البناء للإنتاج

```bash
npm run build
```

## بناء Android / iOS

تمت إضافة Capacitor و GitHub Actions لإنتاج Artifacts Native:

- Android Debug APK عبر `.github/workflows/native-mobile.yml`.
- iOS Simulator App عبر نفس الـ workflow.

محليًا:

```bash
npm run cap:android
npm run android:debug

# macOS فقط
npm run cap:ios
npm run ios:simulator
```

للنشر على Google Play أو App Store يلزم توقيع رسمي وشهادات، موضح في [Mobile Workflow](docs/MOBILE_WORKFLOW.md).

## أهم الأوامر

- `npm run data:build` — توليد بيانات التطبيق من المصادر.
- `npm run validate:quran` — التحقق الصارم من القرآن.
- `npm run validate:data` — التحقق من مصادر الأذكار والتوثيق.
- `npm test` — تشغيل الاختبارات.
- `npm run lint` — TypeScript strict check.

## التوثيق

- [مصادر البيانات](docs/DATA_SOURCES.md)
- [نظام تحقق القرآن](docs/QURAN_VALIDATION.md)
- [المعمارية](docs/ARCHITECTURE.md)
- [الخصوصية](docs/PRIVACY.md)
- [Release](docs/RELEASE.md)
- [Native Android / iOS Workflow](docs/MOBILE_WORKFLOW.md)

## ملاحظات المنصات

PWA لا يستطيع ضمان تشغيل الأذان أو الإشعارات الدقيقة في الخلفية على كل الأنظمة. التطبيق يوضح ذلك للمستخدم ولا يدّعي تجاوز قيود النظام.
