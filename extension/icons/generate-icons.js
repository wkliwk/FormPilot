/**
 * Icon generation script for FormPilot extension.
 *
 * Requires: sharp (available in the project's node_modules)
 * Usage: node extension/icons/generate-icons.js  (from repo root)
 *
 * Generates icon16.png, icon48.png, icon128.png from an embedded SVG.
 */

const sharp = require("sharp");
const path = require("path");

// FormPilot SVG icon: an "F" letter on a document/form shape.
// The document has a folded corner (top-right), giving a classic "form" look.
// Primary color: indigo-600 (#4F46E5) matching the app brand palette.
function svgTemplate(size) {
  const s = size;
  const pad = Math.round(s * 0.08);
  const w = s - pad * 2;
  const h = s - pad * 2;
  const fold = Math.round(w * 0.22);
  const r = Math.round(w * 0.1);

  // F letter proportions
  const fx = pad + Math.round(w * 0.22);
  const fy = pad + Math.round(h * 0.26);
  const fw = Math.round(w * 0.5);
  const fh = Math.round(h * 0.5);
  const fmw = Math.round(fw * 0.7);
  const fBarH = Math.max(2, Math.round(fh * 0.14));
  const fMidY = fy + Math.round(fh * 0.44);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366F1"/>
      <stop offset="100%" style="stop-color:#4F46E5"/>
    </linearGradient>
  </defs>
  <path d="M ${pad + r} ${pad} L ${pad + w - fold} ${pad} L ${pad + w} ${pad + fold} L ${pad + w} ${pad + h - r} Q ${pad + w} ${pad + h} ${pad + w - r} ${pad + h} L ${pad + r} ${pad + h} Q ${pad} ${pad + h} ${pad} ${pad + h - r} L ${pad} ${pad + r} Q ${pad} ${pad} ${pad + r} ${pad} Z" fill="url(#bg)"/>
  <path d="M ${pad + w - fold} ${pad} L ${pad + w - fold} ${pad + fold} L ${pad + w} ${pad + fold} Z" fill="rgba(255,255,255,0.25)"/>
  <rect x="${fx}" y="${fy}" width="${fBarH}" height="${fh}" rx="${Math.round(fBarH * 0.3)}" fill="white"/>
  <rect x="${fx}" y="${fy}" width="${fw}" height="${fBarH}" rx="${Math.round(fBarH * 0.3)}" fill="white"/>
  <rect x="${fx}" y="${fMidY}" width="${fmw}" height="${fBarH}" rx="${Math.round(fBarH * 0.3)}" fill="white"/>
</svg>`;
}

const sizes = [16, 48, 128];
const outputDir = path.join(__dirname);

(async () => {
  for (const size of sizes) {
    const svg = Buffer.from(svgTemplate(size));
    const outPath = path.join(outputDir, `icon${size}.png`);
    await sharp(svg).png().toFile(outPath);
    console.log(`Generated ${outPath}`);
  }
  console.log("Done.");
})();
