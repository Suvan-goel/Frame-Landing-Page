import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(projectRoot, "public");
const imagegenDir = path.join(publicDir, "social", "imagegen");
const outputDir = path.join(publicDir, "social", "facebook");
const wordmarkPath = path.join(publicDir, "frame-wordmark.png");

const colors = {
  cream: "#f3efe6",
  paper: "#faf8f2",
  ink: "#20211e",
  soft: "#5c5b54",
  burgundy: "#8d3e46",
};

const disclosure =
  "Research-stage concept · Not for diagnosis or treatment · Final design may change.";

const concepts = {
  product: {
    source: path.join(
      imagegenDir,
      "exports",
      "frame-product-campaign-hero-feed-1080x1350-v3.png",
    ),
    version: "v8",
    eyebrow: "CONTINUOUSLY TRACK YOUR BLOOD PRESSURE",
    headline: ["See how your", "blood pressure responds", "to daily life."],
    subhead: ["Frame helps you explore patterns across", "sleep, diet, movement and stress"],
    wordmarkWidths: { feed: 210, square: 210, story: 230 },
    eyebrowSizes: { feed: 25, square: 25, story: 26 },
    headlineSizes: { feed: 72, square: 66, story: 88 },
    headlineYPositions: { feed: 260, square: 245, story: 458 },
    headlineLineHeightMultipliers: { feed: 1.15, square: 1.15, story: 1.13 },
    subheadSizes: { feed: 33, square: 31, story: 34 },
    subheadYPositions: { story: 750 },
    subheadLineHeightMultipliers: { feed: 1.5, square: 1.5, story: 1.5 },
    disclosureSizes: { feed: 22, square: 22, story: 22 },
    card: "none",
    showImageCta: false,
    squarePosition: "north",
    storyPosition: "south",
  },
  "product-upright": {
    source: path.join(
      publicDir,
      "frame-product-concept-realistic-v3-transparent.png",
    ),
    layout: "transparent-product",
    version: "v3",
    eyebrow: "CONTINUOUSLY TRACK YOUR BLOOD PRESSURE",
    headline: ["See how your", "blood pressure responds", "to daily life."],
    subhead: ["Frame helps you explore patterns across", "sleep, diet, movement and stress"],
    wordmarkWidths: { feed: 210, square: 210, story: 230 },
    eyebrowSizes: { feed: 25, square: 25, story: 26 },
    headlineSizes: { feed: 72, square: 66, story: 88 },
    headlineYPositions: { feed: 260, square: 245, story: 458 },
    headlineLineHeightMultipliers: { feed: 1.15, square: 1.15, story: 1.13 },
    subheadSizes: { feed: 33, square: 31, story: 34 },
    subheadYPositions: { story: 750 },
    subheadLineHeightMultipliers: { feed: 1.5, square: 1.5, story: 1.5 },
    disclosureSizes: { feed: 22, square: 22, story: 22 },
    card: "none",
    showImageCta: false,
    topWashHeights: { feed: 0, square: 0 },
  },
  routine: {
    source: path.join(
      imagegenDir,
      "exports",
      "frame-morning-routine-feed-1080x1350-v2.png",
    ),
    eyebrow: "PERSONAL, NOT GENERIC",
    headline: ["Your baseline", "is personal."],
    subhead: ["Explore patterns through rest,", "response, and recovery."],
    card: "left",
    cardWidth: 410,
    squarePosition: "north",
    storyPosition: "north",
  },
  movement: {
    source: path.join(
      imagegenDir,
      "exports",
      "frame-morning-walk-feed-1080x1350-v2.png",
    ),
    eyebrow: "CONTEXT BEFORE JUDGEMENT",
    headline: ["Patterns over", "moments."],
    subhead: ["One reading is a moment.", "Daily life is the context."],
    card: "right",
    cardWidth: 420,
    squarePosition: "north",
    storyPosition: "centre",
  },
};

const formats = {
  feed: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function textLines(lines, { x, y, size, lineHeight, className, anchor = "start" }) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" class="${className}" text-anchor="${anchor}">${escapeXml(line)}</text>`,
    )
    .join("");
}

function feedOrSquareOverlay(concept, format) {
  const { width, height } = formats[format];
  const isSquare = format === "square";
  const cardWidth = concept.cardWidth ?? 530;
  const cardX = concept.card === "right" ? width - cardWidth - 48 : 48;
  const cardY = 44;
  const cardHeight = isSquare ? 560 : 590;
  const textX = concept.card === "right" ? cardX + 34 : 78;
  const headlineY =
    concept.headlineYPositions?.[format] ?? (isSquare ? 218 : 236);
  const headlineSize = concept.headlineSizes?.[format] ?? (isSquare ? 57 : 61);
  const subheadSize = concept.subheadSizes?.[format] ?? 23;
  const eyebrowSize = concept.eyebrowSizes?.[format] ?? 17;
  const disclosureSize = concept.disclosureSizes?.[format] ?? 14;
  const headlineLineHeight = Math.round(
    headlineSize * (concept.headlineLineHeightMultipliers?.[format] ?? 0.98),
  );
  const subheadY =
    concept.subheadYPositions?.[format] ??
    headlineY + concept.headline.length * headlineLineHeight + 30;
  const subheadLineHeight = Math.round(
    subheadSize * (concept.subheadLineHeightMultipliers?.[format] ?? 1.34),
  );
  const ctaY = subheadY + 2 * subheadLineHeight + 34;
  const wordmarkX = concept.card === "none" ? 72 : cardX + 30;
  const wordmarkY = 67;
  const topWashHeight = concept.topWashHeights?.[format] ?? 610;
  const cta = concept.showImageCta === false
    ? ""
    : `<rect x="${textX}" y="${ctaY}" width="326" height="62" rx="3" fill="${colors.ink}"/>
      <text x="${textX + 24}" y="${ctaY + 40}" class="cta">Apply for early access  →</text>`;

  const card =
    concept.card === "none"
      ? `<defs>
          <linearGradient id="topWash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${colors.cream}" stop-opacity="0.98"/>
            <stop offset="0.72" stop-color="${colors.cream}" stop-opacity="0.90"/>
            <stop offset="1" stop-color="${colors.cream}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${width}" height="${topWashHeight}" fill="url(#topWash)"/>`
      : `<defs>
          <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#20211e" flood-opacity="0.14"/>
          </filter>
        </defs>
        <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="16"
          fill="${colors.cream}" fill-opacity="0.96" stroke="#20211e" stroke-opacity="0.08" filter="url(#cardShadow)"/>`;

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .eyebrow { font: 650 ${eyebrowSize}px Arial, sans-serif; fill: ${colors.burgundy}; letter-spacing: 2.6px; }
        .headline { font: 400 ${headlineSize}px Georgia, 'Times New Roman', serif; fill: ${colors.ink}; letter-spacing: -2px; }
        .subhead { font: 430 ${subheadSize}px Arial, sans-serif; fill: ${colors.soft}; }
        .cta { font: 650 22px Arial, sans-serif; fill: ${colors.paper}; }
        .disclosure { font: 520 ${disclosureSize}px Arial, sans-serif; fill: ${colors.soft}; letter-spacing: .1px; }
      </style>
      ${card}
      <line x1="${textX}" y1="158" x2="${textX + 44}" y2="158" stroke="${colors.burgundy}" stroke-width="4"/>
      <text x="${textX + 62}" y="164" class="eyebrow">${escapeXml(concept.eyebrow)}</text>
      ${textLines(concept.headline, {
        x: textX,
        y: headlineY,
        size: headlineSize,
        lineHeight: headlineLineHeight,
        className: "headline",
      })}
      ${textLines(concept.subhead, {
        x: textX,
        y: subheadY,
        size: subheadSize,
        lineHeight: subheadLineHeight,
        className: "subhead",
      })}
      ${cta}
      <rect x="0" y="${height - 50}" width="${width}" height="50" fill="${colors.cream}" fill-opacity="0.96"/>
      <text x="54" y="${height - 19}" class="disclosure">${escapeXml(disclosure)}</text>
      <metadata data-wordmark-x="${wordmarkX}" data-wordmark-y="${wordmarkY}"/>
    </svg>
  `);
}

function storyOverlay(concept) {
  const { width, height } = formats.story;
  const textX = 80;
  const headlineY = concept.headlineYPositions?.story ?? 438;
  const headlineSize = concept.headlineSizes?.story ?? 76;
  const subheadSize = concept.subheadSizes?.story ?? 27;
  const headlineLineHeight = Math.round(
    headlineSize * (concept.headlineLineHeightMultipliers?.story ?? 1),
  );
  const subheadLineHeight = Math.round(
    subheadSize * (concept.subheadLineHeightMultipliers?.story ?? 1.4),
  );
  const eyebrowSize = concept.eyebrowSizes?.story ?? 19;
  const disclosureSize = concept.disclosureSizes?.story ?? 15;
  const subheadY = concept.subheadYPositions?.story ?? 620;
  const ctaY = 735;
  const cta = concept.showImageCta === false
    ? ""
    : `<rect x="${textX}" y="${ctaY}" width="382" height="68" rx="3" fill="${colors.ink}"/>
      <text x="${textX + 28}" y="${ctaY + 44}" class="cta">Apply for early access  →</text>`;

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .eyebrow { font: 650 ${eyebrowSize}px Arial, sans-serif; fill: ${colors.burgundy}; letter-spacing: 3px; }
        .headline { font: 400 ${headlineSize}px Georgia, 'Times New Roman', serif; fill: ${colors.ink}; letter-spacing: -2.6px; }
        .subhead { font: 430 ${subheadSize}px Arial, sans-serif; fill: ${colors.soft}; }
        .cta { font: 650 25px Arial, sans-serif; fill: ${colors.paper}; }
        .disclosure { font: 520 ${disclosureSize}px Arial, sans-serif; fill: ${colors.soft}; }
      </style>
      <rect x="0" y="0" width="${width}" height="880" fill="${colors.cream}"/>
      <line x1="${textX}" y1="354" x2="${textX + 50}" y2="354" stroke="${colors.burgundy}" stroke-width="4"/>
      <text x="${textX + 70}" y="361" class="eyebrow">${escapeXml(concept.eyebrow)}</text>
      ${textLines(concept.headline, {
        x: textX,
        y: headlineY,
        size: headlineSize,
        lineHeight: headlineLineHeight,
        className: "headline",
      })}
      ${textLines(concept.subhead, {
        x: textX,
        y: subheadY,
        size: subheadSize,
        lineHeight: subheadLineHeight,
        className: "subhead",
      })}
      ${cta}
      <text x="${textX}" y="851" class="disclosure">${escapeXml(disclosure)}</text>
    </svg>
  `);
}

async function resizedWordmark(width = 174) {
  return sharp(wordmarkPath).resize({ width }).png().toBuffer();
}

function transparentProductBackdrop(format) {
  const { width, height } = formats[format];
  const isStory = format === "story";
  const glowY = isStory ? 1320 : format === "square" ? 760 : 910;
  const shadowY = isStory ? 1650 : format === "square" ? 930 : 1170;
  const shadowRx = isStory ? 350 : format === "square" ? 235 : 300;
  const shadowRy = isStory ? 54 : format === "square" ? 38 : 46;

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="productGlow" cx="62%" cy="52%" r="58%">
          <stop offset="0" stop-color="#c6888c" stop-opacity="0.28"/>
          <stop offset="0.5" stop-color="#e8d5cf" stop-opacity="0.32"/>
          <stop offset="1" stop-color="${colors.cream}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="paperLight" x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0" stop-color="${colors.paper}"/>
          <stop offset="0.58" stop-color="${colors.cream}"/>
          <stop offset="1" stop-color="#e9e1d7"/>
        </linearGradient>
        <filter id="floorBlur" x="-40%" y="-100%" width="180%" height="300%">
          <feGaussianBlur stdDeviation="22"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#paperLight)"/>
      <ellipse cx="700" cy="${glowY}" rx="560" ry="520" fill="url(#productGlow)"/>
      <ellipse cx="690" cy="${shadowY}" rx="${shadowRx}" ry="${shadowRy}"
        fill="#20211e" fill-opacity="0.18" filter="url(#floorBlur)" transform="rotate(-12 690 ${shadowY})"/>
    </svg>
  `);
}

async function renderTransparentProductFeedOrSquare(name, concept, format) {
  const { width, height } = formats[format];
  const placement =
    format === "square"
      ? { width: 500, left: 550, top: 550 }
      : { width: 660, left: 390, top: 620 };
  const product = await sharp(concept.source)
    .resize({ width: placement.width })
    .png()
    .toBuffer();
  const wordmark = await resizedWordmark(concept.wordmarkWidths?.[format] ?? 174);

  await sharp(transparentProductBackdrop(format))
    .composite([
      { input: product, left: placement.left, top: placement.top },
      { input: feedOrSquareOverlay(concept, format), left: 0, top: 0 },
      { input: wordmark, left: 72, top: 67 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(
      path.join(
        outputDir,
        `frame-facebook-${name}-${format}-${concept.version ?? "v1"}.png`,
      ),
    );
}

async function renderTransparentProductStory(name, concept) {
  const { width, height } = formats.story;
  const product = await sharp(concept.source).resize({ width: 850 }).png().toBuffer();
  const wordmark = await resizedWordmark(concept.wordmarkWidths?.story ?? 190);

  await sharp(transparentProductBackdrop("story"))
    .composite([
      { input: product, left: 155, top: 970 },
      { input: storyOverlay(concept), left: 0, top: 0 },
      { input: wordmark, left: 80, top: 250 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(
      path.join(
        outputDir,
        `frame-facebook-${name}-story-${concept.version ?? "v1"}.png`,
      ),
    );
}

async function renderFeedOrSquare(name, concept, format) {
  if (concept.layout === "transparent-product") {
    return renderTransparentProductFeedOrSquare(name, concept, format);
  }

  const { width, height } = formats[format];
  const base = await sharp(concept.source)
    .resize(width, height, {
      fit: "cover",
      position: format === "square" ? concept.squarePosition : "centre",
    })
    .png()
    .toBuffer();
  const wordmark = await resizedWordmark(concept.wordmarkWidths?.[format] ?? 174);
  const wordmarkX =
    concept.card === "right"
      ? width - concept.cardWidth - 48 + 30
      : concept.card === "none"
        ? 72
        : 78;

  await sharp(base)
    .composite([
      { input: feedOrSquareOverlay(concept, format), left: 0, top: 0 },
      { input: wordmark, left: wordmarkX, top: 67 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(
      path.join(
        outputDir,
        `frame-facebook-${name}-${format}-${concept.version ?? "v1"}.png`,
      ),
    );
}

async function renderStory(name, concept) {
  if (concept.layout === "transparent-product") {
    return renderTransparentProductStory(name, concept);
  }

  const { width, height } = formats.story;
  const photo = await sharp(concept.source)
    .resize(width, 1040, { fit: "cover", position: concept.storyPosition })
    .png()
    .toBuffer();
  const wordmark = await resizedWordmark(concept.wordmarkWidths?.story ?? 190);

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: colors.cream,
    },
  })
    .composite([
      { input: photo, left: 0, top: 880 },
      { input: storyOverlay(concept), left: 0, top: 0 },
      { input: wordmark, left: 80, top: 250 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(
      path.join(
        outputDir,
        `frame-facebook-${name}-story-${concept.version ?? "v1"}.png`,
      ),
    );
}

await mkdir(outputDir, { recursive: true });

await Promise.all(
  Object.entries(concepts).flatMap(([name, concept]) => [
    renderFeedOrSquare(name, concept, "feed"),
    renderFeedOrSquare(name, concept, "square"),
    renderStory(name, concept),
  ]),
);

console.log(`Generated ${Object.keys(concepts).length * 3} Facebook ad creatives in ${outputDir}.`);
