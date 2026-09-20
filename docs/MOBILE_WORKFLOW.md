# Native Android / iOS Workflow

تمت إضافة Capacitor لتحويل نسخة الويب الموثقة من صَلِّها إلى تطبيقات Native Shell لـ Android و iOS.

## الملفات المضافة

- `capacitor.config.ts` — إعدادات التطبيق native:
  - `appId`: `com.salliha.app`
  - `appName`: `صَلِّها`
  - `webDir`: `dist`
- `scripts/ensure-cap-platform.mjs` — ينشئ منصة `android` أو `ios` عند الحاجة داخل CI.
- `.github/workflows/native-mobile.yml` — يبني Android و iOS كـ artifacts.

## لماذا لا نُخزّن مجلدات android/ و ios/ في Git؟

الـ workflow يولّدها في CI من `capacitor.config.ts` حتى يبقى المستودع خفيفًا. إذا احتجنا تخصيصات Native دائمة لاحقًا يمكن إزالة `android/` و `ios/` من `.gitignore` والبدء في تتبعها.

## Android Artifact

الوظيفة `android-debug-apk` تقوم بـ:

1. `npm ci`
2. `npm run build`
   - يتضمن `validate:quran`, `validate:data`, `lint`.
3. `node scripts/ensure-cap-platform.mjs android`
4. `npx cap sync android`
5. `./gradlew assembleDebug`
6. رفع artifact باسم `salliha-android-debug-apk`.

الناتج APK Debug مناسب للاختبار الداخلي، وليس للنشر النهائي على Google Play.

## iOS Artifact

الوظيفة `ios-simulator-app` تقوم بـ:

1. `npm ci`
2. `npm run build`
3. `node scripts/ensure-cap-platform.mjs ios`
4. `npx cap sync ios`
5. `xcodebuild` لـ iOS Simulator بدون توقيع.
6. رفع artifact باسم `salliha-ios-simulator-app`.

الناتج `.app` مضغوط مناسب للتشغيل على Simulator فقط.

## النشر الحقيقي على المتاجر

### Android Release / Google Play

لإنتاج AAB أو APK Release يجب إضافة توقيع Android عبر GitHub Secrets مثل:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

ثم إضافة خطوة Gradle لـ `bundleRelease` أو `assembleRelease` مع ملف signing config.

### iOS TestFlight / App Store

إنتاج IPA حقيقي يحتاج Apple signing ولا يمكن تنفيذه بدون حساب Apple Developer وشهادات/Profiles. عادة نحتاج:

- `APPLE_TEAM_ID`
- شهادة Distribution بصيغة base64.
- `P12_PASSWORD`
- Provisioning Profile.
- App Store Connect API key عند الرفع لـ TestFlight.

الـ workflow الحالي يتجنب ادعاء إمكانية إنتاج IPA قابل للنشر بدون هذه المتطلبات.

## أوامر محلية

```bash
npm run cap:android
npm run android:debug

# على macOS فقط:
npm run cap:ios
npm run ios:simulator
```

> تنبيه: أي بناء native يبدأ دائمًا بـ `npm run build`، وبالتالي لا يمكن تجاوز Quran Validation.

## الأيقونة وشاشة البداية

- الملفات المصدرية (SVG) في `resources/`: `icon.svg` (أيقونة كاملة بخلفية)، `icon-foreground.svg` (طبقة المقدمة للأيقونة التكيّفية)، `splash.svg` (شاشة البداية).
- `npm run icons` يولّد:
  - للويب/PWA: `public/icons/icon-96.png`، `icon-192.png`، `icon-512.png`، `icon-maskable-512.png`، `apple-touch-icon.png`، `favicon.png`.
  - لأندرويد (إن وُجد مجلد `android/`): `mipmap-*/ic_launcher*.png` + `ic_launcher_foreground.png` + شاشات `drawable*/splash.png`، ولون خلفية الأيقونة التكيّفية `#1F6F62`.
- `npm run cap:android` يشغّل البناء ثم يزامن المشروع ثم يولّد الأيقونات تلقائيًا، لذا لا حاجة لخطوات يدوية بعد إضافة المنصة.
- اسم التطبيق على الجهاز يأتي من `capacitor.config.ts` (`appName: 'صليها'`) وينعكس في `strings.xml` و`Info.plist` بعد `cap sync`.
