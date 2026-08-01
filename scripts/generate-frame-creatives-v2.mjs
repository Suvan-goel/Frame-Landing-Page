import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(projectRoot, "public");
const socialDir = path.join(publicDir, "social");
const productPath = path.join(
  publicDir,
  "frame-product-concept-realistic-v3-transparent.png",
);

const colors = {
  cream: "#f3efe6",
  ink: "#20211e",
  burgundy: "#8d3e46",
  soft: "#5c5b54",
};

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function textOverlay({ width, height, format }) {
  const layouts = {
    feed: {
      left: 86,
      wordmarkY: 88,
      eyebrowY: 174,
      headlineY: 258,
      headlineSize: 68,
      headlineLines: ["See how your blood pressure", "responds to daily life."],
      ctaY: 424,
      disclosureY: 1315,
    },
    square: {
      left: 76,
      wordmarkY: 76,
      eyebrowY: 158,
      headlineY: 232,
      headlineSize: 58,
      headlineLines: ["See how your blood pressure", "responds to daily life."],
      ctaY: 368,
      disclosureY: 1045,
    },
    story: {
      left: 80,
      wordmarkY: 128,
      eyebrowY: 222,
      headlineY: 328,
      headlineSize: 78,
      headlineLines: ["See how your", "blood pressure responds", "to daily life."],
      ctaY: 602,
      disclosureY: 1855,
    },
  };

  const layout = layouts[format];
  const lineHeight = Math.round(layout.headlineSize * 1.03);
  const headline = layout.headlineLines
    .map(
      (line, index) =>
        `<text x="${layout.left}" y="${layout.headlineY + index * lineHeight}" class="headline">${escapeXml(line)}</text>`,
    )
    .join("");

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .wordmark { font: 600 52px Georgia, 'Times New Roman', serif; fill: ${colors.ink}; letter-spacing: -1px; }
        .eyebrow { font: 650 18px Arial, sans-serif; fill: ${colors.ink}; letter-spacing: 3.2px; }
        .headline { font: 400 ${layout.headlineSize}px Georgia, 'Times New Roman', serif; fill: ${colors.ink}; letter-spacing: -2.5px; }
        .cta { font: 600 27px Arial, sans-serif; fill: ${colors.ink}; }
        .disclosure { font: 500 16px Arial, sans-serif; fill: ${colors.soft}; letter-spacing: .2px; }
      </style>
      <text x="${layout.left}" y="${layout.wordmarkY}" class="wordmark">Frame<tspan fill="${colors.burgundy}">.</tspan></text>
      <line x1="${layout.left}" y1="${layout.eyebrowY - 8}" x2="${layout.left + 52}" y2="${layout.eyebrowY - 8}" stroke="${colors.burgundy}" stroke-width="4" />
      <text x="${layout.left + 72}" y="${layout.eyebrowY}" class="eyebrow">RESEARCH-STAGE ULTRASOUND WEARABLE</text>
      ${headline}
      <text x="${layout.left}" y="${layout.ctaY}" class="cta">Apply for early access →</text>
      <rect x="0" y="${layout.disclosureY - 42}" width="${width}" height="58" fill="${colors.cream}" fill-opacity="0.96" />
      <text x="${layout.left}" y="${layout.disclosureY}" class="disclosure">Illustrative concept · Final design may change.</text>
    </svg>
  `);
}

async function productComposite(width, height, size, left, top) {
  return sharp(productPath)
    .resize(size, size, { fit: "contain" })
    .png()
    .toBuffer()
    .then((input) => ({ input, left, top }));
}

async function createAd({ filename, width, height, format, productSize, left, top }) {
  const product = await productComposite(width, height, productSize, left, top);
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: colors.cream,
    },
  })
    .composite([product, { input: textOverlay({ width, height, format }), left: 0, top: 0 }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(socialDir, filename));
}

function ogTextOverlay() {
  return Buffer.from(`
    <svg width="1732" height="908" viewBox="0 0 1732 908" xmlns="http://www.w3.org/2000/svg">
      <text x="116" y="154" font-family="Georgia, 'Times New Roman', serif" font-size="58" font-weight="600" fill="${colors.ink}">Frame<tspan fill="${colors.burgundy}">.</tspan></text>
      <line x1="116" y1="220" x2="170" y2="220" stroke="${colors.burgundy}" stroke-width="4" />
      <text x="192" y="228" font-family="Arial, sans-serif" font-size="19" font-weight="650" letter-spacing="3.2" fill="${colors.ink}">RESEARCH-STAGE ULTRASOUND WEARABLE</text>
      <text x="116" y="350" font-family="Georgia, 'Times New Roman', serif" font-size="67" letter-spacing="-2.5" fill="${colors.ink}">See how your</text>
      <text x="116" y="420" font-family="Georgia, 'Times New Roman', serif" font-size="67" letter-spacing="-2.5" fill="${colors.ink}">blood pressure responds</text>
      <text x="116" y="490" font-family="Georgia, 'Times New Roman', serif" font-size="67" letter-spacing="-2.5" fill="${colors.ink}">to daily life.</text>
      <text x="116" y="580" font-family="Arial, sans-serif" font-size="25" fill="${colors.ink}">A screenless upper-arm ultrasound wearable</text>
      <text x="116" y="614" font-family="Arial, sans-serif" font-size="25" fill="${colors.ink}">currently in development.</text>
      <text x="116" y="824" font-family="Arial, sans-serif" font-size="17" font-weight="500" fill="${colors.soft}">Illustrative concept · Final design and capabilities may change.</text>
    </svg>
  `);
}

async function createOpenGraphImage() {
  const product = await sharp(productPath)
    .resize(860, 860, { fit: "contain" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 1732,
      height: 908,
      channels: 3,
      background: colors.cream,
    },
  })
    .composite([
      { input: product, left: 850, top: 24 },
      { input: ogTextOverlay(), left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, "og-launch-v2.png"));
}

await mkdir(socialDir, { recursive: true });

await Promise.all([
  createAd({
    filename: "frame-meta-feed-ad-v2.png",
    width: 1080,
    height: 1350,
    format: "feed",
    productSize: 910,
    left: 150,
    top: 445,
  }),
  createAd({
    filename: "frame-meta-square-ad-v2.png",
    width: 1080,
    height: 1080,
    format: "square",
    productSize: 720,
    left: 340,
    top: 360,
  }),
  createAd({
    filename: "frame-meta-story-ad-v2.png",
    width: 1080,
    height: 1920,
    format: "story",
    productSize: 1060,
    left: 10,
    top: 720,
  }),
  createOpenGraphImage(),
]);

console.log("Generated Frame v2 website sharing and Meta campaign assets.");
