import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(
  projectRoot,
  "public/social/imagegen/exports/frame-morning-routine-feed-1080x1350-v2.png",
);
const wordmarkPath = path.join(projectRoot, "public/frame-wordmark.png");
const outputPath = path.join(
  projectRoot,
  "public/social/imagegen/exports/frame-blood-pressure-context-feed-1080x1350-v8.png",
);

const colors = {
  ink: "#20211e",
  soft: "#555650",
  burgundy: "#a32636",
  disclosure: "#f3efe6",
};

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const overlay = Buffer.from(`
  <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <style>
      .eyebrow {
        font: 700 18px Arial, Helvetica, sans-serif;
        fill: ${colors.burgundy};
        letter-spacing: 0.25px;
      }
      .headline {
        font: 400 58px Georgia, 'Times New Roman', serif;
        fill: ${colors.ink};
        letter-spacing: -1.7px;
      }
      .description {
        font: 400 23px Arial, Helvetica, sans-serif;
        fill: ${colors.soft};
      }
      .disclosure {
        font: 500 14px Arial, Helvetica, sans-serif;
        fill: ${colors.disclosure};
        letter-spacing: 0.05px;
      }
    </style>

    <text x="84" y="286" class="eyebrow">${escapeXml("CONTINUOUSLY TRACK YOUR BLOOD PRESSURE")}</text>
    <line x1="84" y1="309" x2="118" y2="309" stroke="${colors.burgundy}" stroke-width="2"/>

    <text x="84" y="394" class="headline">See how your</text>
    <text x="84" y="456" class="headline">blood pressure</text>
    <text x="84" y="518" class="headline">responds to</text>
    <text x="84" y="580" class="headline">daily life.</text>

    <text x="84" y="649" class="description">Frame helps you explore patterns</text>
    <text x="84" y="685" class="description">across sleep, diet, movement</text>
    <text x="84" y="721" class="description">and stress</text>

    <text x="48" y="1322" class="disclosure">${escapeXml(
      "Research-stage concept · Not for diagnosis or treatment · Final design may change.",
    )}</text>
  </svg>
`);

const wordmark = await sharp(wordmarkPath).resize({ width: 286 }).png().toBuffer();

await sharp(sourcePath)
  .composite([
    { input: wordmark, left: 84, top: 104 },
    { input: overlay, left: 0, top: 0 },
  ])
  .png()
  .toFile(outputPath);

console.log(outputPath);
