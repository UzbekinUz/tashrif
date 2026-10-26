// Uchinchi tomon litsenziyalarini node_modules dan yig'ib docs/THIRD_PARTY_LICENSES.md ga yozadi.
// Ishlatish: node scripts/licenses.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const pkgs = Object.entries(lock.packages).filter(([k, v]) => k.startsWith('node_modules/') && !v.dev);

let out = `# Uchinchi tomon litsenziyalari

Tashrif quyidagi ochiq manbali komponentlardan foydalanadi. Bu fayl \`node scripts/licenses.mjs\` bilan yangilanadi.

## Dasturiy paketlar (Node.js)

`;
for (const [k, v] of pkgs) {
  const name = k.replace(/^.*node_modules\//, '');
  const dir = path.join(root, k);
  const file = fs.existsSync(dir) ? fs.readdirSync(dir).find(f => /^(licen[sc]e|copying)(\.|$)/i.test(f)) : null;
  out += `### ${name}@${v.version}\nLitsenziya: ${v.license || "noma'lum"}\n\n`;
  if (file) out += '```\n' + fs.readFileSync(path.join(dir, file), 'utf8').trim() + '\n```\n\n';
}

out += `## Shrift: Inter

Inter shrifti SIL Open Font License 1.1 ostida tarqatiladi (Copyright © The Inter Project Authors, https://github.com/rsms/inter). Tijoratda erkin ishlatish mumkin; shriftni o'zgartirib tarqatganda litsenziya shartlariga rioya qilinadi. Shrift Google Fonts orqali yuklanadi.

## Ikonlar: Feather (uslub)

Interfeysdagi ikonlarning bir qismi Feather ikonlari (https://feathericons.com) asosida chizilgan. Feather MIT litsenziyasi ostida:

\`\`\`
The MIT License (MIT)

Copyright (c) 2013-2023 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
\`\`\`

## Telegram

Telegram Bot API va Mini Apps platformasidan foydalaniladi. Telegram nomi va belgisi Telegram FZ-LLC ga tegishli; Tashrif Telegram bilan rasmiy aloqador emas.
`;
fs.writeFileSync(path.join(root, 'docs', 'THIRD_PARTY_LICENSES.md'), out);
console.log(`docs/THIRD_PARTY_LICENSES.md yozildi (${pkgs.length} ta paket)`);
