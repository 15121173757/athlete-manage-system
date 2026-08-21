/**
 * 出勤状态定义 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 集中管理 6 种标准出勤状态（出勤/伤缺/事假/外赛/集训/停训）
 * 2. 为每种状态绑定固定颜色（前端 UI 与 PDF/Word 报告保持一致）
 * 3. 提供状态查询工具函数
 *
 * 说明：该文件为纯数据/类型模块，可同时被前端组件与服务端逻辑引用，
 * 不得引入 prisma、node 内置模块等运行环境相关依赖。
 */

// ============================================================
// 出勤状态（6 种标准状态）
// ============================================================

export const ATTENDANCE_STATUSES = [
  { code: 'PRESENT', label: '出勤', color: '#00E5A0' },       // 青绿（正常）
  { code: 'INJURED_ABSENT', label: '伤缺', color: '#FF4D6D' }, // 珊瑚红（伤病）
  { code: 'PERSONAL_LEAVE', label: '事假', color: '#FFB800' }, // 琥珀（请假）
  { code: 'COMPETITION', label: '外赛', color: '#2E7CC4' },    // 蓝（外出比赛）
  { code: 'TRAINING_CAMP', label: '集训', color: '#9B59B6' },  // 紫（集训）
  { code: 'SUSPENDED', label: '停训', color: '#5A6A7A' },      // 灰（停训）
] as const;

export type AttendanceStatusCode = (typeof ATTENDANCE_STATUSES)[number]['code'];

export interface AttendanceStatusDef {
  code: AttendanceStatusCode;
  label: string;
  color: string;
}

export const ATTENDANCE_STATUS_CODES = ATTENDANCE_STATUSES.map(
  (s) => s.code
) as unknown as readonly [AttendanceStatusCode, ...AttendanceStatusCode[]];

const STATUS_MAP = new Map<string, AttendanceStatusDef>(
  ATTENDANCE_STATUSES.map((s) => [s.code, s as AttendanceStatusDef])
);

/** 根据 code 获取状态定义（未知 code 返回 null） */
export function getAttendanceStatus(code: string | null | undefined): AttendanceStatusDef | null {
  return STATUS_MAP.get(code as string) ?? null;
}

/** 状态中文名 */
export function getAttendanceStatusLabel(code: string | null | undefined): string {
  return getAttendanceStatus(code)?.label ?? '未知';
}

/** 状态固定颜色（未知状态回退灰色） */
export function getAttendanceStatusColor(code: string | null | undefined): string {
  return getAttendanceStatus(code)?.color ?? '#5A6A7A';
}

/** 未标记（尚未录入出勤状态）在 UI 中的占位定义 */
export const UNMARKED_STATUS = { code: 'UNMARKED', label: '未标记', color: '#3A4A5F' } as const;
