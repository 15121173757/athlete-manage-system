/**
 * 中文字体工具 —— 用于 jsPDF 生成中文 PDF
 *
 * jsPDF 内置的 helvetica 等标准字体仅支持 Latin-1 字符集，
 * 中文必须嵌入 TTF 字体才能正常渲染，否则会乱码。
 * 本项目使用 Noto Sans SC（思源黑体，OFL 开源协议）：
 * - 文件：lib/fonts/NotoSansSC-Regular.ttf
 * - 授权：Open Font License，允许自由嵌入 PDF 分发
 */
import fs from 'fs';
import path from 'path';
import type { jsPDF } from 'jspdf';

const FONT_FILE = 'NotoSansSC-Regular.ttf';
const FONT_PATH = path.join(process.cwd(), 'lib', 'fonts', FONT_FILE);

/** jsPDF 中注册的字体名称 */
export const CN_FONT_NAME = 'NotoSansSC';

let fontBase64Cache: string | null = null;

/** 已注册过字体的 jsPDF 实例（同一实例只注册一次，避免 PDF 内产生重复字体对象） */
const registeredDocs = new WeakSet<jsPDF>();

/** 读取字体文件并转为 base64（模块级缓存，避免每次导出重复读盘） */
function getCNFontBase64(): string {
  if (!fontBase64Cache) {
    fontBase64Cache = fs.readFileSync(FONT_PATH).toString('base64');
  }
  return fontBase64Cache;
}

/**
 * 为指定的 jsPDF 实例注册中文字体并设为当前字体。
 * 同一个实例只会注册一次（normal + bold），之后仅切换字体。
 * 需在调用 doc.text() 之前执行。
 */
export function applyCNFont(doc: jsPDF, style: 'normal' | 'bold' = 'normal'): void {
  if (!registeredDocs.has(doc)) {
    const base64 = getCNFontBase64();
    doc.addFileToVFS(FONT_FILE, base64);
    // 同时注册 normal 与 bold（均指向同一 Regular 字形），保证 setFont(..., 'bold') 不报错
    doc.addFont(FONT_FILE, CN_FONT_NAME, 'normal');
    doc.addFont(FONT_FILE, CN_FONT_NAME, 'bold');
    registeredDocs.add(doc);
  }
  doc.setFont(CN_FONT_NAME, style);
}
