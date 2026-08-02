import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(
  projectRoot,
  "public/social/imagegen/exports/frame-morning-routine-feed-1080x1350-v2.png",
);
const wallPlatePath = path.join(
  projectRoot,
  "public/social/imagegen/frame-morning-routine-solid-wall-plate-v1.png",
);
const wordmarkPath = path.join(projectRoot, "public/frame-wordmark.png");
const outputPath = path.join(
  projectRoot,
  "public/social/imagegen/exports/frame-blood-pressure-context-feed-1080x1350-v12-solid-wall.png",
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

const horizontalWallMask = Buffer.from(`
  <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fadeX" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="white" stop-opacity="1"/>
        <stop offset="0.72" stop-color="white" stop-opacity="1"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="300" height="1350" fill="url(#fadeX)"/>
  </svg>
`);

const verticalWallMask = Buffer.from(`
  <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fadeY" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="white" stop-opacity="1"/>
        <stop offset="0.88" stop-color="white" stop-opacity="1"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="1080" height="830" fill="url(#fadeY)"/>
  </svg>
`);

const textOverlay = Buffer.from(`
  <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <style>
      .eyebrow {
        font: 700 16.5px Arial, Helvetica, sans-serif;
        fill: ${colors.burgundy};
        letter-spacing: 0.25px;
      }
      .headline {
        font: 400 55px Georgia, 'Times New Roman', serif;
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

    <text x="84" y="390" class="headline">See how your</text>
    <text x="84" y="450" class="headline">blood pressure</text>
    <text x="84" y="510" class="headline">responds to</text>
    <text x="84" y="570" class="headline">daily life.</text>

    <text x="84" y="640" class="description">Frame helps you explore</text>
    <text x="84" y="676" class="description">patterns across sleep, diet,</text>
    <text x="84" y="712" class="description">movement and stress</text>

    <text x="48" y="1322" class="disclosure">${escapeXml(
      "Research-stage concept · Not for diagnosis or treatment · Final design may change.",
    )}</text>
  </svg>
`);

const wallLayer = await sharp(wallPlatePath)
  .ensureAlpha()
  .composite([
    { input: horizontalWallMask, left: 0, top: 0, blend: "dest-in" },
    { input: verticalWallMask, left: 0, top: 0, blend: "dest-in" },
  ])
  .png()
  .toBuffer();

const wordmark = await sharp(wordmarkPath).resize({ width: 286 }).png().toBuffer();

await sharp(sourcePath)
  .composite([
    { input: wallLayer, left: 0, top: 0 },
    { input: wordmark, left: 84, top: 104 },
    { input: textOverlay, left: 0, top: 0 },
  ])
  .png()
  .toFile(outputPath);

console.log(outputPath);
