import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const outDir = path.join(root, 'itch-build');

function rmDsStore(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) rmDsStore(p);
    else if (ent.name === '.DS_Store') fs.unlinkSync(p);
  }
}

function stripGoogleTag(html) {
  return html.replace(
    /\r?\n\s*<!-- Google tag \(gtag\.js\) -->[\s\S]*?<\/script>\s*<script>[\s\S]*?<\/script>/,
    '',
  );
}

function verifyItchBuild() {
  const indexPath = path.join(outDir, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const errors = [];

  if (!html.includes('<!DOCTYPE html>')) errors.push('index.html missing doctype');

  if (/googletagmanager\.com|gtag\('config'/.test(html)) {
    errors.push('Google Analytics snippets still present in index.html');
  }

  const scriptMatch = html.match(/<script[^>]+src="([^"]+)"/);
  if (!scriptMatch) errors.push('No script src in index.html');
  else {
    const rel = scriptMatch[1];
    if (rel.startsWith('http') || rel.startsWith('/')) {
      errors.push(`Script src not relative: ${rel}`);
    } else {
      const abs = path.join(outDir, rel);
      if (!fs.existsSync(abs)) errors.push(`Missing bundle: ${rel}`);
    }
  }

  const imgMatch = html.match(/<img[^>]+src="([^"]+)"/);
  if (imgMatch) {
    const rel = imgMatch[1];
    if (rel.startsWith('http') || rel.startsWith('/')) {
      errors.push(`Image src not relative: ${rel}`);
    } else {
      const abs = path.join(outDir, rel);
      if (!fs.existsSync(abs)) errors.push(`Missing image: ${rel}`);
    }
  }

  const dataPath = path.join(outDir, 'data', 'game-balance.json');
  if (!fs.existsSync(dataPath)) errors.push('Missing data/game-balance.json');

  if (errors.length) {
    console.error('itch-build verification failed:\n', errors.join('\n'));
    process.exit(1);
  }
  console.log('itch-build verification passed.');
}

if (!fs.existsSync(distDir)) {
  console.error('dist/ not found. Run npm run build first.');
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.cpSync(distDir, outDir, { recursive: true });
rmDsStore(outDir);

const indexPath = path.join(outDir, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
fs.writeFileSync(indexPath, stripGoogleTag(html));

verifyItchBuild();
