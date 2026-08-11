/**
 * 器材简笔画导出脚本 —— 输出 SVG / PNG / JPG 多格式文件
 *
 * 运行：npx tsx scripts/export-equipment-icons.ts
 * 输出目录：public/equipment-icons/
 *  - {key}.svg            矢量图标（品牌橙 #FF6B35，透明底）
 *  - {key}-48px/96px/192px.png  多尺寸透明底 PNG
 *  - {key}.jpg            白底深色线稿（适合打印/浅色文档）
 *  - atlas.svg / atlas.png 全部图标图集（含中文名称，整齐网格排列）
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { EQUIPMENT_ICONS } from '../lib/equipment-icons/registry';

const OUT = path.join(process.cwd(), 'public', 'equipment-icons');
const ORANGE = '#FF6B35';
const NAVY = '#0A1929';
const WHITE = '#FFFFFF';

function wrap(inner: string, stroke: string, bg?: string): string {
  const background = bg ? `<rect width="48" height="48" fill="${bg}"/>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="192" height="192" ` +
    `fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
    background +
    inner +
    `</svg>`
  );
}

/** 图集 SVG（网格排列，图标 + 中文名称） */
function buildAtlasSvg(): string {
  const cols = 6;
  const cellW = 140;
  const cellH = 160;
  const rows = Math.ceil(EQUIPMENT_ICONS.length / cols);
  const width = cols * cellW;
  const height = rows * cellH;

  const defs = EQUIPMENT_ICONS.map(
    (ic) => `<g id="ic-${ic.key}">${ic.svg}</g>`
  ).join('');

  const cells = EQUIPMENT_ICONS.map((ic, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const iconX = col * cellW + (cellW - 60) / 2; // 60px 图标居中
    const iconY = row * cellH + 18;
    const textX = col * cellW + cellW / 2;
    const textY = row * cellH + 118;
    return (
      `<g transform="translate(${iconX}, ${iconY}) scale(1.25)"><use href="#ic-${ic.key}"/></g>` +
      `<text x="${textX}" y="${textY}" text-anchor="middle" font-family="Microsoft YaHei, PingFang SC, sans-serif" ` +
      `font-size="15" fill="${NAVY}">${ic.label}</text>`
    );
  }).join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ` +
    `fill="none" stroke="${ORANGE}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<rect width="${width}" height="${height}" fill="${WHITE}"/>` +
    `<defs>${defs}</defs>${cells}</svg>`
  );
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  for (const icon of EQUIPMENT_ICONS) {
    const base = path.join(OUT, icon.key);

    // 1. SVG 矢量文件
    fs.writeFileSync(`${base}.svg`, wrap(icon.svg, ORANGE));

    // 2. PNG 透明底多尺寸
    for (const size of [48, 96, 192]) {
      await sharp(Buffer.from(wrap(icon.svg, ORANGE)))
        .resize(size, size)
        .png()
        .toFile(`${base}-${size}px.png`);
    }

    // 3. JPG 白底深色线稿
    await sharp(Buffer.from(wrap(icon.svg, NAVY, WHITE)))
      .resize(192, 192)
      .jpeg({ quality: 92 })
      .toFile(`${base}.jpg`);

    console.log(`✓ ${icon.label} (${icon.key})`);
  }

  // 4. 图集（含中文名称）
  const atlasSvg = buildAtlasSvg();
  fs.writeFileSync(path.join(OUT, 'atlas.svg'), atlasSvg);
  await sharp(Buffer.from(atlasSvg))
    .png()
    .toFile(path.join(OUT, 'atlas.png'));
  console.log('✓ 图集 atlas.svg / atlas.png');

  console.log(`导出完成 → public/equipment-icons/（共 ${EQUIPMENT_ICONS.length} 个器材）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
