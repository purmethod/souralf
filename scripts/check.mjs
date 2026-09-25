// Pre-push check: JS syntax, local references, asset budget, brand spelling.
// Run: node scripts/check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const fail = [];

execFileSync(process.execPath, ['--check', path.join(root, 'app.js')]);

for (const page of ['index.html', '404.html']) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^(https?:|mailto:|data:)/.test(ref)) continue;
    const file = path.join(root, ref.split('?')[0].replace(/^\//, '')) ;
    if (ref === '/' ) continue;
    if (!fs.existsSync(file)) fail.push(`${page}: missing ${ref}`);
  }
}

for (const dir of ['assets']) {
  for (const f of fs.readdirSync(path.join(root, dir))) {
    const st = fs.statSync(path.join(root, dir, f));
    if (st.isFile() && !f.endsWith('.md') && st.size > 400 * 1024) fail.push(`${dir}/${f} is ${Math.round(st.size / 1024)} KB (> 400 KB)`);
  }
}

// The brand is always written ÂLF. Technical slugs (domain, repo, Instagram handle) are exempt.
const allowed = /souralf|sour\.alf/gi; // check.mjs:allow
const wrong = /(?<![A-Za-zÂ])(?:alf|Alf|ALF|Âlf|âlf|ÄLF|Älf|äLF)(?![A-Za-z])/g; // check.mjs:allow
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.name.startsWith('.') || e.name === 'node_modules' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const file of walk(root)) {
  if (!/\.(html|css|js|mjs|md|json|txt|xml|svg)$/.test(file)) continue;
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const hits = line.replace(allowed, '').replace(/ÂLF/g, '').match(wrong);
    if (hits && !line.includes('check.mjs:allow')) fail.push(`${path.relative(root, file)}:${i + 1} "${hits[0]}"`);
  });
}

if (fail.length) {
  console.error('FAIL\n' + fail.join('\n'));
  process.exit(1);
}
console.log('PASS: syntax, local references, asset sizes, brand spelling (ÂLF).');
