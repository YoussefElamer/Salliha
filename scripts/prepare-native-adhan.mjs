import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/';
const sounds = [
  ['abdulbasit-egypt', 'Abdulbasit_Abdusamad_1_-_Egypt_(عبد_الباسط_عبد_الصمد_-_مصر).mp3', 'Abdulbasit_Abdusamad_6_-_Fajr_Egypt_(عبد_الباسط_عبد_الصمد_-_فجر_مصر).mp3'],
  ['ahmad-nuinaa-egypt', 'Ahmed_Nuinaa_1_-_Egypt_(أحمد_نعينع_-_مصر).mp3', 'Adhan_Fajr_Cairo_Egypt_(أذان_الفجر_القاهرة_مصر).mp3'],
  ['haram-makki', 'Adhan_Al_Haram_Al_Maki_(أذان_الحرم_المكي).mp3', 'Adhan_Fajr_Al_Haram_Al_Maki_(أذان_الفجر_الحرم_المكي).mp3'],
  ['haram-madani', 'Adhan_Al_Haram_Al_Madani_-_Al_Madinah_1_(أذان_الحرم_المدني_-_المدينة_المنورة).mp3', 'Adhan_Fajr_Al_Haram_Al_Madani_(أذان_الفجر_الحرم_المدني).mp3'],
  ['makkah', 'Adhan_Al_Haram_Al_Maki_(أذان_الحرم_المكي).mp3', 'Adhan_Fajr_Al_Haram_Al_Maki_(أذان_الفجر_الحرم_المكي).mp3'],
  ['riyadh', 'Adhan_Riyadh_Saudi_Arabia_(أذان_الرياض_السعودية).mp3', 'Adhan_Fajr_Al_Haram_Al_Maki_(أذان_الفجر_الحرم_المكي).mp3']
];

async function download(url, destination) {
  if (fs.existsSync(destination)) return;
  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`⚠️ Skipping unavailable native adhan asset: HTTP ${response.status} ${url}`);
    return false;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, buffer);
  return true;
}

async function main() {
  const androidRaw = path.join(root, 'android', 'app', 'src', 'main', 'res', 'raw');
  const iosResources = path.join(root, 'ios', 'App', 'App', 'Resources');
  for (const [id, normal, fajr] of sounds) {
    await download(raw + encodeURIComponent(normal).replace(/%2F/g, '/').replace(/%28/g, '(').replace(/%29/g, ')'), path.join(androidRaw, `adhan_${id}.mp3`)).catch((error) => { console.warn(error); });
    await download(raw + encodeURIComponent(fajr).replace(/%2F/g, '/').replace(/%28/g, '(').replace(/%29/g, ')'), path.join(androidRaw, `adhan_${id}_fajr.mp3`)).catch((error) => { console.warn(error); });
    await download(raw + encodeURIComponent(normal).replace(/%2F/g, '/').replace(/%28/g, '(').replace(/%29/g, ')'), path.join(iosResources, `adhan_${id}.mp3`)).catch((error) => { console.warn(error); });
    await download(raw + encodeURIComponent(fajr).replace(/%2F/g, '/').replace(/%28/g, '(').replace(/%29/g, ')'), path.join(iosResources, `adhan_${id}_fajr.mp3`)).catch((error) => { console.warn(error); });
  }
  console.log('Prepared native Adhan audio assets.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
