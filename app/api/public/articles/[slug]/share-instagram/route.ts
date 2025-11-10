import sharp from "sharp";
import { ArticleStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSiteConfig } from "@/lib/site-config/server";
import { deriveThumbnailUrl } from "@/lib/storage/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;

const CARD_WIDTH = 1020;
const CARD_PADDING = 12;
const CARD_LEFT = Math.round((CANVAS_WIDTH - CARD_WIDTH) / 2);

const IMAGE_HEIGHT = 640;
const IMAGE_CORNER_RADIUS = 40;

const TITLE_FONT_SIZE = 52;
const TITLE_LINE_HEIGHT = 65;
const TITLE_MAX_LINES = 4;
const TITLE_MAX_CHARS_PER_LINE = 32;
const TITLE_SPACING = 30;

const TOP_MARGIN = 28;
const BRAND_GAP = 8;
const CARD_TOP_GAP = 10;

const FOOTER_BAR_HEIGHT = 160;
const THEME_PRIMARY = "#2767ac";
const THEME_ACCENT = "#2b66a6";

const GRADIENT_SVG = `<svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c1ddff" />
      <stop offset="55%" stop-color="#d8e6ff" />
      <stop offset="100%" stop-color="#f5f9ff" />
    </linearGradient>
  </defs>
  <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#bg-grad)" />
</svg>`;

const fetchBuffer = async (url: string | null | undefined) => {
  if (!url) {
    return null;
  }
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Gagal mengambil resource ${url}:`, error);
    return null;
  }
};

const escapeSvgText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const wrapTitle = (title: string) => {
  const sanitized = title.trim();
  if (!sanitized) {
    return ["Artikel Tanpa Judul"];
  }

  const words = sanitized.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  let index = 0;
  let truncated = false;

  while (index < words.length) {
    const word = words[index];
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= TITLE_MAX_CHARS_PER_LINE) {
      current = candidate;
      index += 1;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
      if (lines.length === TITLE_MAX_LINES) {
        truncated = true;
        break;
      }
      continue;
    }

    const chunks = word.match(new RegExp(`.{1,${TITLE_MAX_CHARS_PER_LINE}}`, "g")) ?? [word];
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      lines.push(chunks[chunkIndex]);
      if (lines.length === TITLE_MAX_LINES) {
        truncated = chunkIndex < chunks.length - 1 || index < words.length - 1;
        break;
      }
    }
    index += 1;
    if (lines.length === TITLE_MAX_LINES) {
      break;
    }
  }

  if (!truncated && current) {
    lines.push(current);
  } else if (truncated && current && lines.length < TITLE_MAX_LINES) {
    lines.push(current);
  }

  if (lines.length > TITLE_MAX_LINES) {
    lines.length = TITLE_MAX_LINES;
    truncated = true;
  }

  if (truncated && lines.length > 0) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = `${lines[lastIndex].replace(/\.*$/, "")}…`;
  }

  return lines;
};

const createTitleSvg = (lines: string[], width: number) => {
  const effectiveLines = lines.length > 0 ? lines : ["Artikel Tanpa Judul"];
  const titleHeight = TITLE_LINE_HEIGHT * effectiveLines.length;
  const titleSvg = `<svg width="${width}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .title { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: ${TITLE_FONT_SIZE}px; font-weight: 700; fill: ${THEME_PRIMARY}; }
    </style>
    ${effectiveLines
      .map(
        (line, idx) =>
          `<text x="0" y="${TITLE_FONT_SIZE + idx * TITLE_LINE_HEIGHT}" class="title">${escapeSvgText(line)}</text>`
      )
      .join("")}
  </svg>`;
  return { buffer: Buffer.from(titleSvg), height: titleHeight };
};

const createCardBackground = (width: number, height: number) => {
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#0f172a" flood-opacity="0.12" />
      </filter>
    </defs>
    <rect width="${width}" height="${height}" rx="56" ry="56" fill="rgba(255,255,255,0.96)" stroke="#e2e8f0" filter="url(#shadow)" />
  </svg>`;
  return Buffer.from(svg);
};

const createRoundedImage = async (buffer: Buffer, width: number, height: number) => {
  const resized = await sharp(buffer)
    .resize({
      width,
      height,
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .toBuffer();

  const mask = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" rx="${IMAGE_CORNER_RADIUS}" ry="${IMAGE_CORNER_RADIUS}" fill="#fff"/>
    </svg>`
  );

  return sharp(resized)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
};

const createFooterBarSvg = (displayUrl: string) => {
  const escapedUrl = escapeSvgText(displayUrl);
  const svg = `<svg width="${CANVAS_WIDTH}" height="${FOOTER_BAR_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${CANVAS_WIDTH}" height="${FOOTER_BAR_HEIGHT}" fill="${THEME_ACCENT}" />
    <text x="50%" y="56%" text-anchor="middle" fill="#ffffff" font-family="'Helvetica Neue', Arial, sans-serif" font-size="54" font-weight="600">${escapedUrl}</text>
  </svg>`;
  return Buffer.from(svg);
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return new Response("Slug artikel tidak valid.", { status: 400 });
  }
  const { searchParams } = new URL(request.url);
  const articleUrlParam = searchParams.get("articleUrl");

  const article = await prisma.article.findUnique({
    where: { slug },
    select: {
      title: true,
      status: true,
      featuredMedia: {
        select: {
          url: true,
          thumbnailUrl: true,
          mimeType: true,
        },
      },
    },
  });

  if (!article || article.status !== ArticleStatus.PUBLISHED) {
    return new Response("Artikel tidak ditemukan.", { status: 404 });
  }

  const siteConfig = await getSiteConfig();
  const siteName = siteConfig.name ?? "Roemah Cita";
  const articleUrl =
    articleUrlParam ??
    (siteConfig.url ? `${siteConfig.url}/articles/${slug}` : `https://example.com/articles/${slug}`);

  const displayUrl = (() => {
    const base = siteConfig.url ?? articleUrl;
    try {
      const parsed = new URL(base.startsWith("http") ? base : `https://${base}`);
      return `${parsed.protocol}//${parsed.host}/`;
    } catch {
      return `${base.replace(/^https?:\/\//i, "").replace(/\/+$/, "")}/`;
    }
  })();

  const isVideo = article.featuredMedia?.mimeType?.startsWith("video/") ?? false;
  const featuredImageUrl =
    (isVideo ? article.featuredMedia?.thumbnailUrl : article.featuredMedia?.url) ??
    deriveThumbnailUrl(article.featuredMedia?.url ?? "") ??
    null;

  const [logoBuffer, featuredBuffer] = await Promise.all([
    fetchBuffer(siteConfig.logoUrl ?? null),
    fetchBuffer(featuredImageUrl),
  ]);

  if (!featuredBuffer) {
    return new Response("Artikel tidak memiliki gambar unggulan yang dapat diproses.", {
      status: 422,
    });
  }

  const base = sharp(Buffer.from(GRADIENT_SVG), { density: 240 })
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT)
    .png();

  const composites: sharp.OverlayOptions[] = [];

  let currentTop = TOP_MARGIN;

  if (logoBuffer) {
    const resizedLogo = await sharp(logoBuffer)
      .resize({
        width: 420,
        height: 140,
        fit: "inside",
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toBuffer();

    const logoMeta = await sharp(resizedLogo).metadata();
    const logoWidth = logoMeta.width ?? 0;
    const logoHeight = logoMeta.height ?? 0;

    composites.push({
      input: resizedLogo,
      top: currentTop,
      left: Math.max(0, Math.round((CANVAS_WIDTH - logoWidth) / 2)),
    });

    currentTop += logoHeight + BRAND_GAP;
  } else {
    const fallbackLogoSvg = Buffer.from(
      `<svg width="${CANVAS_WIDTH}" height="140" xmlns="http://www.w3.org/2000/svg">
        <style>
          .brand { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 76px; font-weight: 700; fill: ${THEME_PRIMARY}; }
        </style>
        <text x="50%" y="65%" text-anchor="middle" class="brand">${escapeSvgText(siteName)}</text>
      </svg>`
    );

    composites.push({
      input: fallbackLogoSvg,
      top: currentTop,
      left: 0,
    });

    currentTop += 140 + BRAND_GAP;
  }

  currentTop += CARD_TOP_GAP;

  const cardInnerWidth = CARD_WIDTH - CARD_PADDING * 2;
  const titleLines = wrapTitle(article.title ?? "");
  const { buffer: titleBuffer, height: titleHeight } = createTitleSvg(titleLines, cardInnerWidth);
  const cardHeight = CARD_PADDING * 2 + IMAGE_HEIGHT + TITLE_SPACING + titleHeight;
  const cardTop = currentTop;

  composites.push({
    input: createCardBackground(CARD_WIDTH, cardHeight),
    top: cardTop,
    left: CARD_LEFT,
  });

  const roundedImage = await createRoundedImage(featuredBuffer, cardInnerWidth, IMAGE_HEIGHT);

  composites.push({
    input: roundedImage,
    top: cardTop + CARD_PADDING,
    left: CARD_LEFT + CARD_PADDING,
  });

  composites.push({
    input: titleBuffer,
    top: cardTop + CARD_PADDING + IMAGE_HEIGHT + TITLE_SPACING,
    left: CARD_LEFT + CARD_PADDING,
  });

  composites.push({
    input: createFooterBarSvg(`https://${displayUrl.replace(/^https?:\/\//i, "")}`),
    top: CANVAS_HEIGHT - FOOTER_BAR_HEIGHT,
    left: 0,
  });

  const outputBuffer = await base.composite(composites).png().toBuffer();
  const arrayBuffer = outputBuffer.buffer.slice(
    outputBuffer.byteOffset,
    outputBuffer.byteOffset + outputBuffer.byteLength
  ) as ArrayBuffer;

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${slug}-instagram-share.png"`,
    },
  });
}
