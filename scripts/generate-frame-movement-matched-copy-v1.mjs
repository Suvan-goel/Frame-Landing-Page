import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(
  projectRoot,
  "public/social/imagegen/exports/frame-morning-walk-feed-1080x1350-v2.png",
);
const wordmarkPath = path.join(projectRoot, "public/frame-wordmark.png");
const outputPath = path.join(
  projectRoot,
  "public/social/imagegen/exports/frame-morning-walk-matched-copy-feed-1080x1350-v2.png",
);

const colors = {
  card: "#f3efe6",
  ink: "#20211e",
  soft: "#5c5b54",
  burgundy: "#8d3e46",
};

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const overlay = Buffer.from(`
  <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#20211e" flood-opacity="0.14"/>
      </filter>
    </defs>
    <style>
      .eyebrow {
        font: 700 12.2px Arial, Helvetica, sans-serif;
        fill: ${colors.burgundy};
        letter-spacing: 0.2px;
      }
      .headline {
        font: 400 50px Georgia, 'Times New Roman', serif;
        fill: ${colors.ink};
        letter-spacing: -1.6px;
      }
      .description {
        font: 400 20px Arial, Helvetica, sans-serif;
        fill: ${colors.soft};
      }
      .disclosure {
        font: 500 14px Arial, Helvetica, sans-serif;
        fill: ${colors.soft};
      }
    </style>

    <rect x="612" y="44" width="420" height="610" rx="16"
      fill="${colors.card}" fill-opacity="0.97" stroke="#20211e" stroke-opacity="0.08"
      filter="url(#cardShadow)"/>

    <line x1="646" y1="158" x2="690" y2="158" stroke="${colors.burgundy}" stroke-width="4"/>
    <text x="708" y="164" class="eyebrow">${escapeXml("CONTINUOUSLY TRACK YOUR BLOOD PRESSURE")}</text>

    <text x="646" y="230" class="headline">See how your</text>
    <text x="646" y="282" class="headline">blood pressure</text>
    <text x="646" y="334" class="headline">responds to</text>
    <text x="646" y="386" class="headline">daily life.</text>

    <text x="646" y="460" class="description">Frame helps you explore</text>
    <text x="646" y="490" class="description">patterns across sleep, diet,</text>
    <text x="646" y="520" class="description">movement and stress</text>

    <rect x="0" y="1300" width="1080" height="50" fill="${colors.card}" fill-opacity="0.97"/>
    <text x="54" y="1332" class="disclosure">${escapeXml(
      "Research-stage concept · Not for diagnosis or treatment · Final design may change.",
    )}</text>
  </svg>
`);

const wordmark = await sharp(wordmarkPath).resize({ width: 190 }).png().toBuffer();

await sharp(sourcePath)
  .composite([
    { input: overlay, left: 0, top: 0 },
    { input: wordmark, left: 646, top: 70 },
  ])
  .png()
  .toFile(outputPath);

console.log(outputPath);
