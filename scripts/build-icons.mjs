/**
 * يبني أيقونات التطبيق وشاشة البداية من ملفات SVG المصدرية في resources/.
 *
 * المخرجات:
 *  - public/icons/icon-192.png و icon-512.png و icon-maskable-512.png و apple-touch-icon.png (PWA / الويب)
 *  - مجلدات mipmap-* في Android: ic_launcher و ic_launcher_round و ic_launcher_foreground (Android)
 *  - android/app/src/main/res/drawable/splash.png (Android)
 *  - ios/App/App/Assets.xcassets/AppIcon.appiconset/*.png و Splash.imageset/splash.png (iOS)
 *
 * يُشغَّل جزءًا من `npm run icons` ويُستدعى تلقائيًا قبل `cap sync` عبر `npm run cap:prepare`.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const RES = path.join(root, 'resources');
const iconSvg = fs.readFileSync(path.join(RES, 'icon.svg'));
const foregroundSvg = fs.readFileSync(path.join(RES, 'icon-foreground.svg'));
const splashSvg = fs.readFileSync(path.join(RES, 'splash.svg'));

const write = async (buffer, target) => {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer);
  return target;
};

const resize = (svg, size, background) => {
  let pipeline = sharp(svg, { density: 480 }).resize(size, size, { fit: 'contain', background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } });
  return pipeline.png({ compressionLevel: 9 }).toBuffer();
};

/**
 * نسخة بخلفية معتمة من لون العلامة — ضرورية لأيقونات النظام:
 * الشفافية حول الزوايا كانت تظهر كمربعات سوداء/بيضاء في لانشر أندرويد
 * وفي أيقونة iOS وفي الأيقونة القابلة للكمامة (maskable).
 */
const BRAND_BACKGROUND = { r: 31, g: 111, b: 98 };
const resizeFlat = (svg, size) =>
  sharp(svg, { density: 480 })
    .resize(size, size, { fit: 'contain' })
    .flatten({ background: BRAND_BACKGROUND })
    .png({ compressionLevel: 9 })
    .toBuffer();

const results = [];

/* ---------- PWA / الويب ---------- */
const publicIcons = path.join(root, 'public', 'icons');
for (const size of [96, 192, 512]) {
  results.push(await write(await resize(iconSvg, size), path.join(publicIcons, `icon-${size}.png`)));
}
// الأيقونة القابلة للكمامة وأيقونة iOS تحتاجان خلفية معتمة بالكامل (بلا شفافية).
results.push(await write(await resizeFlat(iconSvg, 512), path.join(publicIcons, 'icon-maskable-512.png')));
results.push(await write(await resizeFlat(iconSvg, 180), path.join(root, 'public', 'apple-touch-icon.png')));
results.push(await write(await resizeFlat(iconSvg, 32), path.join(root, 'public', 'favicon.png')));

/* ---------- Android ---------- */
const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res');
const androidDensities = [
  { folder: 'mipmap-mdpi', launcher: 48, foreground: 108, splashWidth: 480 },
  { folder: 'mipmap-hdpi', launcher: 72, foreground: 162, splashWidth: 720 },
  { folder: 'mipmap-xhdpi', launcher: 96, foreground: 216, splashWidth: 960 },
  { folder: 'mipmap-xxhdpi', launcher: 144, foreground: 324, splashWidth: 1440 },
  { folder: 'mipmap-xxxhdpi', launcher: 192, foreground: 432, splashWidth: 1920 }
];

if (fs.existsSync(androidRes)) {
  for (const density of androidDensities) {
  const dir = path.join(androidRes, density.folder);
  results.push(await write(await resizeFlat(iconSvg, density.launcher), path.join(dir, 'ic_launcher.png')));
  results.push(await write(await resizeFlat(iconSvg, density.launcher), path.join(dir, 'ic_launcher_round.png')));
    // الأيقونة التكيّفية (Android 8+): المقدمة شفافة وتُقص إلى 66% كحد أقصى، لذلك نرسم الفن داخل المنطقة الآمنة.
    results.push(await write(await resize(foregroundSvg, density.foreground), path.join(dir, 'ic_launcher_foreground.png')));
  }
  const splashBuffer = await sharp(splashSvg, { density: 240 })
    .resize(1080, 1920, { fit: 'cover', position: 'center' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const splashWidths = { mdpi: 360, hdpi: 540, xhdpi: 720, xxhdpi: 1080, xxxhdpi: 1440 };
  for (const density of Object.keys(splashWidths)) {
    const width = splashWidths[density];
    // نسخة عمودية وأخرى أفقية لتناسب دوران الشاشة.
    results.push(await write(await sharp(splashBuffer).resize(width).png().toBuffer(), path.join(androidRes, `drawable-port-${density}`, 'splash.png')));
    results.push(await write(await sharp(splashBuffer).resize(Math.round(width * 1.6)).png().toBuffer(), path.join(androidRes, `drawable-land-${density}`, 'splash.png')));
    results.push(await write(await sharp(splashBuffer).resize(width).png().toBuffer(), path.join(androidRes, `drawable-${density}`, 'splash.png')));
  }
  results.push(await write(await sharp(splashBuffer).resize(1080).png().toBuffer(), path.join(androidRes, 'drawable', 'splash.png')));
}

/* ---------- iOS ---------- */
const iosIconDir = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
if (fs.existsSync(path.join(root, 'ios'))) {
  const iosSizes = [
    { name: 'icon-20@2x.png', size: 40 },
    { name: 'icon-20@3x.png', size: 60 },
    { name: 'icon-29@2x.png', size: 58 },
    { name: 'icon-29@3x.png', size: 87 },
    { name: 'icon-40@2x.png', size: 80 },
    { name: 'icon-40@3x.png', size: 120 },
    { name: 'icon-60@2x.png', size: 120 },
    { name: 'icon-60@3x.png', size: 180 },
    { name: 'icon-76@2x.png', size: 152 },
    { name: 'icon-83.5@2x.png', size: 167 },
    { name: 'icon-1024.png', size: 1024 }
  ];
  for (const entry of iosSizes) {
    results.push(await write(await resizeFlat(iconSvg, entry.size), path.join(iosIconDir, entry.name)));
  }
  results.push(
    await write(
      await sharp(splashSvg, { density: 240 }).resize(1284, 2778, { fit: 'cover' }).png().toBuffer(),
      path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset', 'splash.png')
    )
  );
}

console.log(`✅ Icons + splash generated (${results.length} files).`);
if (!fs.existsSync(androidRes)) console.log('ℹ️ مجلد android غير موجود بعد — شغّل npm run cap:android ثم npm run icons لتوليد أيقونات Android.');
if (!fs.existsSync(path.join(root, 'ios'))) console.log('ℹ️ مجلد ios غير موجود بعد — شغّل npm run cap:ios ثم npm run icons لتوليد أيقونات iOS.');
