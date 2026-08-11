import { NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { applyCNFont } from '@/lib/utils/cnPdfFont';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

/**
 * POST /api/sport-science/needs-analysis/export
 * 运动需求分析报告 PDF 导出（服务端生成，嵌入中文字体）
 *
 * body: {
 *   title: string;          // 报告标题
 *   athleteName: string;    // 运动员
 *   sportLabel: string;     // 专项
 *   generatedAt: string;    // 生成时间
 *   sections: { heading: string; lines: string[] }[];
 * }
 */

interface PdfSection {
  heading: string;
  lines: string[];
}

export async function POST(req: Request) {
  try {
    await requirePermission(Permissions.TRAINING_READ);

    const body = await req.json();
    const { title, athleteName, sportLabel, generatedAt, sections } = body as {
      title: string;
      athleteName: string;
      sportLabel: string;
      generatedAt: string;
      sections: PdfSection[];
    };
    if (!Array.isArray(sections)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '缺少报告内容' } },
        { status: 400 }
      );
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 16;
    const contentWidth = pageWidth - marginX * 2;
    let y = 18;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
    };

    // 头部
    applyCNFont(doc, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('AMS 运动员管理系统 · 运动科学工具箱', marginX, 12);
    doc.text(generatedAt, pageWidth - marginX, 12, { align: 'right' });
    doc.setDrawColor(30, 58, 95);
    doc.line(marginX, 14.5, pageWidth - marginX, 14.5);

    // 标题（以页面水平中心为锚点居中，jsPDF align:center 以首个 x 参数为圆心）
    y = 26;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(20);
    doc.text(title || '运动需求分析报告', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(11);
    doc.setTextColor(70, 70, 70);
    const sub = `运动员：${athleteName || '未指定'}    专项：${sportLabel || '—'}`;
    doc.text(sub, pageWidth / 2, y, { align: 'center' });
    y += 10;

    // 分节
    for (const section of sections) {
      ensureSpace(16);
      doc.setDrawColor(30, 58, 95);
      doc.line(marginX, y - 4, pageWidth - marginX, y - 4);
      applyCNFont(doc, 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(section.heading, marginX, y);
      y += 7;

      applyCNFont(doc, 'normal');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      for (const line of section.lines) {
        // 超长行按宽度折行
        const wrapped = doc.splitTextToSize(line, contentWidth);
        ensureSpace(wrapped.length * 5.2 + 1);
        doc.text(wrapped, marginX, y);
        y += wrapped.length * 5.2;
      }
      y += 6;
    }

    // 页脚
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      applyCNFont(doc, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      doc.text('AMS 运动需求分析报告 · 内部资料', marginX, pageHeight - 10);
      doc.text(`第 ${i} 页 / 共 ${pages} 页`, pageWidth - marginX, pageHeight - 10, { align: 'right' });
    }

    const buffer = Buffer.from(doc.output('arraybuffer'));
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="needs-analysis-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
