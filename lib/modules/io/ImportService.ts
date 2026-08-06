/**
 * 数据导入服务 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 解析 Excel/CSV 文件为结构化数据
 * 2. 批量导入运动员档案
 * 3. 数据校验与错误报告
 *
 * 支持的列：
 * - name（必填）, gender（男/女）, birthDate（YYYY-MM-DD）
 * - height, weight, sport（必填）, position, joinDate（YYYY-MM-DD）, status
 */

import * as XLSX from 'xlsx';
import { prisma } from '@/lib/db/prisma';
import { Gender, AthleteStatus } from '@/types';
import { logAction } from '@/lib/modules/audit/AuditService';

// ============================================================
// 类型定义
// ============================================================

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; name: string; reason: string }>;
}

interface ParsedAthlete {
  name: string;
  gender: string;
  birthDate: string;
  height?: number | null;
  weight?: number | null;
  sport: string;
  position?: string | null;
  joinDate: string;
  status?: string;
}

// ============================================================
// parseFile —— 解析 Excel/CSV 文件
// ============================================================

export function parseFile(buffer: Buffer, filename: string): ParsedAthlete[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // 转为 JSON，header 用第一行
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return rows.map((row, index) => {
    // 兼容中英文列名
    const raw: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
      raw[key.toLowerCase().trim()] = row[key];
    }

    const name = String(raw['name'] || raw['姓名'] || '').trim();
    const genderRaw = String(raw['gender'] || raw['性别'] || '').trim();
    const gender = genderRaw === '男' || genderRaw === 'MALE' ? Gender.MALE
      : genderRaw === '女' || genderRaw === 'FEMALE' ? Gender.FEMALE : '';

    const birthDate = normalizeDate(raw['birthdate'] || raw['出生日期'] || raw['生日']);
    const joinDate = normalizeDate(raw['joindate'] || raw['入队日期'] || raw['入队时间']);

    const height = parseNumber(raw['height'] || raw['身高']);
    const weight = parseNumber(raw['weight'] || raw['体重']);
    const sport = String(raw['sport'] || raw['项目'] || '').trim();
    const position = String(raw['position'] || raw['位置'] || '').trim() || null;
    const statusRaw = String(raw['status'] || raw['状态'] || '').trim().toUpperCase();
    const status = statusRaw === 'ACTIVE' || statusRaw === '在队' ? AthleteStatus.ACTIVE
      : statusRaw === 'RECOVERING' || statusRaw === '休养' ? AthleteStatus.RECOVERING
      : statusRaw === 'LEFT' || statusRaw === '离队' ? AthleteStatus.LEFT
      : AthleteStatus.ACTIVE;

    return {
      name,
      gender,
      birthDate: birthDate || '',
      height: height || null,
      weight: weight || null,
      sport,
      position: position || null,
      joinDate: joinDate || new Date().toISOString().split('T')[0],
      status,
    };
  });
}

// ============================================================
// importAthletes —— 批量导入运动员
// ============================================================

export async function importAthletes(
  data: ParsedAthlete[],
  operatorId: number
): Promise<ImportResult> {
  const result: ImportResult = {
    total: data.length,
    success: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const rowNum = i + 2; // Excel 行号（第1行是表头）

    // 校验必填字段
    if (!item.name) {
      result.failed++;
      result.errors.push({ row: rowNum, name: '(空)', reason: '姓名不能为空' });
      continue;
    }
    if (!item.gender) {
      result.failed++;
      result.errors.push({ row: rowNum, name: item.name, reason: '性别无效（应为男/女）' });
      continue;
    }
    if (!item.birthDate) {
      result.failed++;
      result.errors.push({ row: rowNum, name: item.name, reason: '出生日期格式无效（应为 YYYY-MM-DD）' });
      continue;
    }
    if (!item.sport) {
      result.failed++;
      result.errors.push({ row: rowNum, name: item.name, reason: '项目不能为空' });
      continue;
    }

    try {
      // 检查重名
      const existing = await prisma.athlete.findFirst({ where: { name: item.name } });
      if (existing) {
        result.failed++;
        result.errors.push({ row: rowNum, name: item.name, reason: '姓名已存在' });
        continue;
      }

      await prisma.athlete.create({
        data: {
          name: item.name,
          gender: item.gender as 'MALE' | 'FEMALE',
          birthDate: new Date(item.birthDate),
          height: item.height,
          weight: item.weight,
          sport: item.sport,
          position: item.position,
          joinDate: new Date(item.joinDate),
          status: (item.status || AthleteStatus.ACTIVE) as 'ACTIVE' | 'RECOVERING' | 'LEFT',
        },
      });
      result.success++;
    } catch (err) {
      result.failed++;
      result.errors.push({
        row: rowNum,
        name: item.name,
        reason: err instanceof Error ? err.message : '数据库写入失败',
      });
    }
  }

  await logAction({
    userId: operatorId,
    action: 'IMPORT_ATHLETES',
    targetType: 'Athlete',
    targetId: 0,
    detail: { total: result.total, success: result.success, failed: result.failed },
  });

  return result;
}

// ============================================================
// 辅助函数
// ============================================================

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) return str.replace(/\//g, '-');

  // Excel 序列号
  const num = Number(str);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const date = new Date(Date.UTC(1899, 11, 30) + num * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }

  return null;
}

function parseNumber(value: unknown): number | null {
  if (!value || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}
