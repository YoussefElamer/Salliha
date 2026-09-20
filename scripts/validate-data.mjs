import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const sha256 = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, filePath))).digest('hex');
const readJson = (filePath) => JSON.parse(fs.readFileSync(path.join(root, filePath), 'utf8'));
const fail = (message) => {
  console.error(`❌ Data validation failed: ${message}`);
  process.exit(1);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};

const adhkarSourcePath = 'data/sources/adhkar/morning-evening-ar.json';
const adhkarHashPath = 'data/sources/adhkar/morning-evening-ar.sha256';
const adhkarGeneratedPath = 'src/data/adhkar/adhkar.generated.json';
const expectedAdhkarHash = fs.readFileSync(path.join(root, adhkarHashPath), 'utf8').trim().split(/\s+/)[0];
const actualAdhkarHash = sha256(adhkarSourcePath);
assert(actualAdhkarHash === expectedAdhkarHash, `Adhkar source hash changed. Expected ${expectedAdhkarHash}, got ${actualAdhkarHash}`);

const adhkarSource = readJson(adhkarSourcePath);
const adhkarGenerated = readJson(adhkarGeneratedPath);
assert(Array.isArray(adhkarSource), 'Adhkar source must be an array');
assert(Array.isArray(adhkarGenerated.items), 'Generated adhkar items must be an array');
assert(adhkarGenerated.meta?.sourceSha256 === actualAdhkarHash, 'Generated adhkar metadata hash mismatch');
assert(adhkarGenerated.items.length === adhkarSource.length, 'Generated adhkar item count changed');
assert(adhkarGenerated.items.length > 0, 'No adhkar data available');

const seen = new Set();
for (let index = 0; index < adhkarSource.length; index += 1) {
  const source = adhkarSource[index];
  const generated = adhkarGenerated.items[index];
  assert(!seen.has(generated.id), `Duplicate adhkar id ${generated.id}`);
  seen.add(generated.id);
  assert(generated.order === source.order, `Adhkar order mismatch at index ${index}`);
  assert(generated.content === source.content, `Adhkar content changed at order ${source.order}`);
  assert(generated.count === source.count, `Adhkar count changed at order ${source.order}`);
  assert(generated.source === source.source, `Adhkar source reference changed at order ${source.order}`);
  assert(Array.isArray(generated.categories) && generated.categories.length > 0, `Adhkar ${generated.id} has no category`);
}

const docs = [
  'docs/DATA_SOURCES.md',
  'docs/QURAN_VALIDATION.md',
  'docs/PRIVACY.md',
  'docs/ARCHITECTURE.md',
  'docs/RELEASE.md',
  'docs/MOBILE_WORKFLOW.md'
];
for (const doc of docs) {
  assert(fs.existsSync(path.join(root, doc)), `Missing documentation file ${doc}`);
}

console.log('✅ Data validation passed: source hashes, generated data integrity, categories, and required docs verified.');
