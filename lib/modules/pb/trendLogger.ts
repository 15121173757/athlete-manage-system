/**
 * PB 变化趋势数据抓取日志 —— 服务端模块
 *
 * 职责：
 * 1. 记录趋势数据抓取过程的关键节点（请求参数、查询结果、耗时）
 * 2. 记录数据异常（无效记录、空结果、PB 不一致等），便于追溯与告警
 *
 * 说明：
 * - 日志按天落盘到 logs/pb-trend-YYYY-MM-DD.log，追加写入；
 * - 日志系统完全容错：任何失败（目录不可写、磁盘满等）只打印 console 警告，绝不影响业务；
 * - 仅供服务端调用，不得在浏览器环境引用（依赖 node:fs）。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ============================================================
// 日志工具
// ============================================================

/** 日志级别 */
type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

/** 日志目录（相对项目根目录） */
const LOG_DIR_REL = 'logs';

function logFilePath(): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(process.cwd(), LOG_DIR_REL, `pb-trend-${date}.log`);
}

/** 当前时间（本地时区） */
function nowStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 追加写入一行日志。容错：任何异常仅输出 console 警告，不影响调用方。
 * 目录不存在时自动创建（递归）。
 */
async function appendLog(level: LogLevel, message: string): Promise<void> {
  try {
    const filePath = logFilePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const line = `[${nowStr()}] [${level}] ${message}${os.EOL}`;
    await fs.appendFile(filePath, line, { encoding: 'utf8' });
  } catch (err) {
    console.warn('[trendLogger] 写入日志失败（不影响业务）:', err);
  }
}

// ============================================================
// 对外接口
// ============================================================

/** 记录一次趋势查询的开始（关键节点） */
export function logTrendQueryStart(params: {
  athleteId: number;
  exerciseIds: number[];
  startDate?: string;
  endDate?: string;
}): void {
  void appendLog(
    'INFO',
    `趋势查询开始 athleteId=${params.athleteId} exerciseIds=[${params.exerciseIds.join(',')}]` +
      ` range=[${params.startDate ?? '不限'} ~ ${params.endDate ?? '不限'}]`
  );
}

/** 记录趋势查询结果与数据校验摘要（关键节点） */
export function logTrendQueryComplete(params: {
  athleteId: number;
  exerciseIds: number[];
  startDate?: string;
  endDate?: string;
  totalRecords: number;
  seriesCount: number;
  totalPoints: number;
  durationMs: number;
}): void {
  void appendLog(
    'INFO',
    `趋势查询完成 athleteId=${params.athleteId} exerciseIds=[${params.exerciseIds.join(',')}]` +
      ` range=[${params.startDate ?? '不限'} ~ ${params.endDate ?? '不限'}]` +
      ` records=${params.totalRecords} series=${params.seriesCount} points=${params.totalPoints} cost=${params.durationMs}ms`
  );
}

/** 记录数据异常（告警日志，供人工排查） */
export function logTrendAnomaly(message: string, detail?: string): void {
  void appendLog('WARNING', `${message}${detail ? ` | ${detail}` : ''}`);
}

/** 记录严重错误 */
export function logTrendError(message: string, error?: unknown): void {
  const errText = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '');
  void appendLog('ERROR', `${message}${errText ? ` | ${errText}` : ''}`);
}

/** 记录自动修复动作 */
export function logTrendRepair(message: string, detail?: string): void {
  void appendLog('INFO', `[自动修复] ${message}${detail ? ` | ${detail}` : ''}`);
}
