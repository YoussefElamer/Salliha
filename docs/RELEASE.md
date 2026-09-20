# Build & Release

## المتطلبات

- Node.js 20 أو أحدث.
- npm.

## إعداد محلي

```bash
npm install
npm run data:build
npm run validate:quran
npm run test
npm run dev
```

## Release Build

```bash
npm run build
```

هذا الأمر ينفذ بالترتيب:

1. توليد البيانات من المصادر.
2. التحقق من القرآن.
3. التحقق من البيانات العامة والتوثيق.
4. TypeScript lint.
5. Build الإنتاج.

## فشل البناء

يفشل البناء إذا:

- تغير Hash مصدر القرآن.
- نقصت سورة أو آية.
- اختلف نص آية بين المصدر والبيانات المولدة.
- فشلت الاختبارات.
- فشل TypeScript.

## نشر PWA

بعد `npm run build` يتم نشر مجلد `dist/` على أي Static Hosting يدعم HTTPS. HTTPS مطلوب للـ Service Worker والإشعارات والموقع.

## بناء Android / iOS

يوجد workflow مستقل:

```text
.github/workflows/native-mobile.yml
```

ينشئ Capacitor platforms داخل CI، ثم يرفع:

- Android Debug APK.
- iOS Simulator App بدون توقيع.

راجع `docs/MOBILE_WORKFLOW.md` لتفاصيل التوقيع والنشر على المتاجر.

## قبل أي إصدار عام

- راجع `docs/DATA_SOURCES.md`.
- شغّل `npm run validate:quran`.
- شغّل `npm test`.
- اختبر Offline من DevTools.
- اختبر رفض صلاحيات الموقع والإشعارات.
- اختبر الاتجاه RTL و Dark Mode.
