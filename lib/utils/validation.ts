// ============================================================
// 请求数据校验 —— 运动员管理系统（AMS）
// ============================================================
// 职责：
// 1. 定义所有 API 入参的 Zod Schema
// 2. 与 Prisma Schema 保持同步
// 3. 提供类型安全的解析入口
// ============================================================

import { z } from 'zod';
import { EXERCISE_CATEGORIES, TRACK_TYPE_CODES } from '@/lib/exercise/track-types';
import { FITNESS_TEST_CATEGORIES } from '@/lib/fitness/test-types';
import { ATTENDANCE_STATUS_CODES } from '@/lib/attendance/attendance-types';

// ============================================================
// 运动员
// ============================================================

// 兼容 'YYYY-MM-DD'（前端 date input）与 ISO 8601 datetime 两种格式
const dateString = z.string().refine(
  (val) => {
    if (!val) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return true;
    return !isNaN(new Date(val).getTime());
  },
  '日期格式不正确'
);

export const athleteCreateSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(50, '姓名不能超过50个字符'),
  gender: z.enum(['MALE', 'FEMALE'], { errorMap: () => ({ message: '性别无效' }) }),
  birthDate: dateString,
  height: z.number().positive('身高必须为正数').optional().nullable(),
  weight: z.number().positive('体重必须为正数').optional().nullable(),
  sport: z.string().min(1, '项目不能为空').max(50, '项目不能超过50个字符'),
  position: z.string().max(50, '位置不能超过50个字符').optional().nullable(),
  joinDate: dateString,
  photoUrl: z.string().url('照片URL格式不正确').optional().nullable(),
});

export const athleteUpdateSchema = athleteCreateSchema.partial();

// ============================================================
// 训练计划
// ============================================================

export const trainingPlanItemSchema = z.object({
  athleteId: z.number().int().positive('运动员ID必须为正整数').optional().nullable(),
  exerciseId: z.number().int().positive('项目ID必须为正整数'),
  sets: z.number().int().positive('组数必须为正整数'),
  reps: z.number().int().positive('次数必须为正整数'),
  load: z.number().positive('负荷必须为正数').optional().nullable(),
  restSeconds: z.number().int().min(0, '间歇时间不能为负数').max(600, '间歇时间不能超过600秒').optional().nullable(),
  duration: z.number().int().min(1, '时长必须为正整数').max(600, '时长不能超过600分钟').optional().nullable(),
  tempo: z.string().max(20, '节奏不能超过20个字符').optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().max(500, '备注不能超过500个字符').optional().nullable(),
});

export const trainingPlanCreateSchema = z.object({
  athleteIds: z.array(z.number().int().positive('运动员ID必须为正整数')).min(1, '请至少选择一名运动员'),
  goal: z.string().max(500, '目标不能超过500个字符').optional().nullable(),
  startDate: dateString,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '开始时间格式不正确'),
  status: z.enum(['DRAFT', 'SCHEDULED', 'COMPLETED']).optional(),
  items: z.array(trainingPlanItemSchema).min(1, '请至少添加一个练习项目'),
});

// 草稿创建：允许暂缺运动员/执行时间/练习项目，正式发布时再校验完整性
export const trainingPlanDraftSchema = z.object({
  athleteIds: z.array(z.number().int().positive('运动员ID必须为正整数')).default([]),
  goal: z.string().max(500, '目标不能超过500个字符').optional().nullable(),
  startDate: dateString.optional().nullable(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '开始时间格式不正确').optional().nullable(),
  status: z.enum(['DRAFT']).optional(),
  items: z.array(trainingPlanItemSchema).default([]),
});

// ============================================================
// 训练记录
// ============================================================

export const trainingRecordCreateSchema = z.object({
  athleteId: z.number().int().positive('运动员ID必须为正整数'),
  planItemId: z.number().int().positive('计划项ID必须为正整数').optional().nullable(),
  exerciseId: z.number().int().positive('项目ID必须为正整数'),
  actualSets: z.number().int().positive('实际组数必须为正整数'),
  actualReps: z.number().int().positive('实际次数必须为正整数'),
  actualLoad: z.number().positive('实际负荷必须为正数').optional().nullable(),
  metricValue: z.number().positive('量化值必须为正数').optional().nullable(),
  trainingDate: z.string().datetime('训练日期格式不正确'),
  rpe: z.number().int().min(1, 'RPE必须为1-10').max(10, 'RPE必须为1-10').optional().nullable(),
  notes: z.string().max(500, '备注不能超过500个字符').optional().nullable(),
});

// ============================================================
// 出勤记录
// ============================================================

export const attendanceUpsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式不正确'),
  athleteId: z.number().int().positive('运动员ID必须为正整数'),
  status: z.enum(ATTENDANCE_STATUS_CODES, { errorMap: () => ({ message: '出勤状态无效' }) }),
  rpe: z
    .number()
    .int('RPE 值必须为 1-10 的整数')
    .min(1, 'RPE 值必须为 1-10 的整数')
    .max(10, 'RPE 值必须为 1-10 的整数')
    .optional()
    .nullable(),
  durationMinutes: z
    .number()
    .int('训练时长必须为非负整数（分钟）')
    .min(0, '训练时长必须为非负整数（分钟）')
    .optional()
    .nullable(),
  notes: z.string().max(500, '备注不能超过500个字符').optional().nullable(),
});

// ============================================================
// 跳跃分析（视频跳跃生物力学分析工具）
// ============================================================

export const JUMP_TEST_TYPE_CODES = ['CMJ', 'SJ', 'DJ', 'REPEAT_10_5'] as const;

const repeatJumpDatumSchema = z.object({
  index: z.number().int().positive('跳跃序号必须为正整数'),
  flightTimeMs: z.number().positive('飞行时间必须为正数'),
  contactTimeMs: z.number().nonnegative('触地时间不能为负数').nullable().optional(),
});

export const jumpAnalysisCreateSchema = z.object({
  athleteId: z.number().int().positive('运动员ID必须为正整数'),
  testType: z.enum(JUMP_TEST_TYPE_CODES, { errorMap: () => ({ message: '测试类型无效' }) }),
  testDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式不正确'),
  videoName: z.string().max(255, '视频文件名不能超过255个字符').nullable().optional(),
  videoFps: z.number().int().min(1, '帧率必须为正整数').max(1000, '帧率超出合理范围').nullable().optional(),
  flightTimeMs: z.number().positive('飞行时间必须为正数').nullable().optional(),
  contactTimeMs: z.number().nonnegative('触地时间不能为负数').nullable().optional(),
  dropHeightCm: z.number().int().min(1, '下落高度必须为正整数').max(200, '下落高度超出合理范围').nullable().optional(),
  details: z.array(repeatJumpDatumSchema).max(20, '单次测试跳跃次数不能超过20次').optional(),
  notes: z.string().max(2000, '备注不能超过2000个字符').nullable().optional(),
});

// ============================================================
// 体能测试
// ============================================================

/**
 * 测试标准（常模）条目 schema
 *
 * - normName：常模名称，必填，1-50 字符
 * - mean：平均值，必填，有效数字且最多保留两位小数
 * - stdDev：标准差，必填，大于 0 且最多保留两位小数
 */
export const testStandardSchema = z.object({
  normName: z
    .string()
    .min(1, '常模名称不能为空')
    .max(50, '常模名称不能超过50个字符'),
  mean: z
    .number({ invalid_type_error: '平均值必须为有效数字' })
    .refine((v) => Number.isFinite(v), '平均值必须为有效数字')
    .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-9, '平均值最多保留两位小数'),
  stdDev: z
    .number({ invalid_type_error: '标准差必须为有效数字' })
    .refine((v) => Number.isFinite(v), '标准差必须为有效数字')
    .refine((v) => v > 0, '标准差必须大于0')
    .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-9, '标准差最多保留两位小数'),
});

/** 测试标准（常模）数组 schema：至少保留一套，最多 50 套 */
export const testStandardArraySchema = z
  .array(testStandardSchema)
  .min(1, '请至少保留一套测试标准')
  .max(50, '测试标准不能超过50套');

/** 测试项目基础 schema：创建/更新共用字段定义 */
const fitnessTestBaseSchema = z.object({
  name: z.string().min(1, '测试名称不能为空').max(100, '名称不能超过100个字符'),
  category: z.enum(FITNESS_TEST_CATEGORIES, {
    errorMap: () => ({ message: '分类无效' }),
  }),
  unit: z.string().min(1, '单位不能为空').max(20, '单位不能超过20个字符'),
  direction: z.enum(['HIGHER_BETTER', 'LOWER_BETTER']).optional().nullable(),
  warningThreshold: z.number().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  purpose: z.string().max(500).optional().nullable(),
  applicableGroup: z.string().max(200).optional().nullable(),
  equipment: z.string().max(500).optional().nullable(),
  demoVideoUrl: z.string().url('视频链接格式不正确').max(500).optional().nullable(),
  diagramUrl: z.string().url('图解链接格式不正确').max(500).optional().nullable(),
  standards: testStandardArraySchema.optional().nullable(),
  precautions: z.string().max(1000).optional().nullable(),
  // 成绩类型：NUMERIC 数值 / GRADE 等级 / DESCRIPTIVE 描述
  resultType: z.enum(['NUMERIC', 'GRADE', 'DESCRIPTIVE'], {
    invalid_type_error: '成绩类型无效',
  }).optional(),
  // 等级型成绩选项（GRADE 时必填，至少 2 个、最多 20 个）；null 表示清除（切换成绩类型时）
  gradeOptions: z
    .array(
      z
        .string()
        .min(1, '等级选项不能为空')
        .max(20, '等级选项不能超过20个字符')
    )
    .min(2, '等级型项目至少需要2个成绩选项')
    .max(20, '等级选项不能超过20个')
    .optional()
    .nullable(),
});

/** 创建测试项目：GRADE 时必须配置成绩选项 */
export const fitnessTestCreateSchema = fitnessTestBaseSchema.superRefine((data, ctx) => {
  if (data.resultType === 'GRADE' && (!data.gradeOptions || data.gradeOptions.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['gradeOptions'],
      message: '等级型项目必须配置成绩选项',
    });
  }
});

/** 更新测试项目：部分字段可缺省 */
export const fitnessTestUpdateSchema = fitnessTestBaseSchema.partial();

/** 成绩录入行：value 为原始录入文本，null/空串表示清空该成绩 */
export const fitnessResultRowSchema = z.object({
  athleteId: z.number().int().positive('运动员ID无效'),
  testId: z.number().int().positive('测试项目ID无效'),
  value: z.string().max(500, '成绩值不能超过500个字符').nullable(),
});

/** 测试计划成绩批量保存 schema */
export const fitnessResultsSaveSchema = z.object({
  results: z
    .array(fitnessResultRowSchema)
    .max(2000, '单次成绩录入不能超过2000条'),
});

export const fitnessRecordCreateSchema = z.object({
  athleteId: z.number().int().positive('运动员ID必须为正整数'),
  testId: z.number().int().positive('测试项目ID必须为正整数'),
  value: z.number().positive('测试值必须为正数'),
  testDate: z.string().datetime('测试日期格式不正确'),
});

// ============================================================
// 伤病
// ============================================================

export const injuryCreateSchema = z.object({
  athleteId: z.number().int().positive('运动员ID必须为正整数'),
  injuryType: z.string().min(1, '伤病类型不能为空').max(100, '伤病类型不能超过100个字符'),
  description: z.string().min(1, '描述不能为空').max(1000, '描述不能超过1000个字符'),
  bodyPart: z.string().min(1, '受伤部位不能为空').max(100, '受伤部位不能超过100个字符'),
  cause: z.string().min(1, '受伤原因不能为空').max(500, '受伤原因不能超过500个字符'),
  diagnosis: z.string().min(1, '诊断结果不能为空').max(500, '诊断结果不能超过500个字符'),
  treatment: z.string().min(1, '治疗方案不能为空').max(1000, '治疗方案不能超过1000个字符'),
  startDate: z.string().datetime('受伤日期格式不正确'),
  endDate: z.string().datetime('痊愈日期格式不正确').optional().nullable(),
  status: z.enum(['INJURED', 'RECOVERING', 'RETURNED']).optional(),
});

// 更新伤病：所有字段可选（至少提交一项），单字段沿用创建校验规则
export const injuryUpdateSchema = injuryCreateSchema.partial();

// ============================================================
// 康复计划
// ============================================================

export const recoveryPlanCreateSchema = z.object({
  injuryId: z.number().int().positive('伤病ID必须为正整数'),
  content: z.string().min(1, '康复内容不能为空').max(2000, '康复内容不能超过2000个字符'),
  startDate: z.string().datetime('开始日期格式不正确'),
  targetReturnDate: z.string().datetime('目标回归日期格式不正确'),
});

// ============================================================
// 健康指标
// ============================================================

export const healthMetricCreateSchema = z.object({
  athleteId: z.number().int().positive('运动员ID必须为正整数'),
  metricType: z.enum(['HEART_RATE', 'SLEEP', 'RPE', 'HRV'], {
    errorMap: () => ({ message: '指标类型无效' }),
  }),
  value: z.number({ required_error: '指标值必须为数字', invalid_type_error: '指标值必须为数字' }),
  unit: z.string().min(1, '单位不能为空').max(20, '单位不能超过20个字符'),
  recordedAt: z.string().datetime('记录时间格式不正确'),
  source: z.enum(['MANUAL', 'POLAR']).optional(),
});

// ============================================================
// 练习管理
// ============================================================

export const exerciseCreateSchema = z.object({
  name: z.string().min(1, '练习名称不能为空').max(50, '名称不能超过50个字符'),
  category: z.enum(EXERCISE_CATEGORIES, { errorMap: () => ({ message: '分类无效' }) }),
  unit: z.string().min(1, '计量单位不能为空').max(20, '单位不能超过20个字符'),
  description: z.string().max(500, '描述不能超过500个字符').optional().nullable(),
  difficulty: z.enum(['初级', '中级', '高级']).optional().nullable(),
  targetMuscles: z.string().max(200, '目标肌群不能超过200个字符').optional().nullable(),
  equipment: z.string().max(500, '所用器材不能超过500个字符').optional().nullable(),
  demoImageUrl: z.string().url('图片URL格式不正确').max(500).optional().nullable(),
  demoVideoUrl: z.string().url('视频URL格式不正确').max(500).optional().nullable(),
  isFavorite: z.boolean().optional(),
  sortOrder: z.number().int('排序必须为整数').optional(),
  isPBTrackable: z.boolean().optional(),
  trackType: z.enum(TRACK_TYPE_CODES, { errorMap: () => ({ message: '追踪类型无效' }) }).optional(),
});

export const exerciseUpdateSchema = exerciseCreateSchema.partial();

// ============================================================
// 体能测试计划
// ============================================================

export const fitnessPlanCreateSchema = z.object({
  name: z.string().min(1, '计划名称不能为空').max(100, '名称不能超过100个字符'),
  testDate: z.string().min(1, '测试日期不能为空'),
  startTime: z.string().optional().nullable(),
  estimatedDuration: z.number().int().min(1, '预计时长必须为正整数').max(600).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  weather: z.string().max(100).optional().nullable(),
  venueCondition: z.string().max(500).optional().nullable(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'COMPLETED']).optional(),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(z.object({
    testId: z.number().int().positive('测试项目ID必须为正整数'),
    sortOrder: z.number().int().min(0).optional(),
    groupName: z.string().max(50).optional().nullable(),
    allocatedMinutes: z.number().int().min(1).max(300).optional().nullable(),
  })).optional(),
  participantIds: z.array(z.number().int().positive()).optional(),
});