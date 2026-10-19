// Generates public/icons/*.png from an SVG with sharp.
// Usage: node scripts/make-icons.mjs
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// Full-bleed square (iOS rounds the corners itself). `pad` shrinks the art for maskable icons.
const svg = (pad = 0) => {
  const s = 512, inner = s - pad * 2, k = inner / 512;
  const t = (x) => pad + x * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <radialGradient id="g" cx="50%" cy="20%" r="90%">
      <stop offset="0" stop-color="#fffaf1"/><stop offset="1" stop-color="#f3e6d2"/>
    </radialGradient>
  </defs>
  <rect width="${s}" height="${s}" fill="url(#g)"/>
  <!-- gold & red thread (senyera nod) -->
  ${[0, 1, 2, 3].map((i) => `<rect x="0" y="${t(404 + i * 22)}" width="${s}" height="${11 * k}" fill="${i % 2 ? '#d6a23e' : '#b8402e'}" opacity=".9"/>`).join('')}
  <!-- seal -->
  <rect x="${t(96)}" y="${t(70)}" width="${320 * k}" height="${300 * k}" rx="${54 * k}" fill="#b8402e" transform="rotate(-4 ${t(256)} ${t(220)})"/>
  <rect x="${t(118)}" y="${t(92)}" width="${276 * k}" height="${256 * k}" rx="${38 * k}" fill="none" stroke="#fff4e6" stroke-opacity=".5" stroke-width="${5 * k}" transform="rotate(-4 ${t(256)} ${t(220)})"/>
  <g transform="rotate(-4 ${t(256)} ${t(220)})" fill="#fff8ef">
    <text x="${t(170)}" y="${t(262)}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="700" font-size="${118 * k}">ca</text>
    <text x="${t(336)}" y="${t(266)}" text-anchor="middle" font-family="'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif" font-weight="700" font-size="${120 * k}">中</text>
  </g>
</svg>`;
};

writeFileSync(join(OUT, 'icon.svg'), svg());
const base = Buffer.from(svg());
const masked = Buffer.from(svg(56));
await sharp(base).resize(180, 180).png().toFile(join(OUT, 'apple-touch-icon.png'));
await sharp(base).resize(192, 192).png().toFile(join(OUT, 'icon-192.png'));
await sharp(base).resize(512, 512).png().toFile(join(OUT, 'icon-512.png'));
await sharp(masked).resize(512, 512).png().toFile(join(OUT, 'icon-512-maskable.png'));
console.log('icons written to', OUT);
