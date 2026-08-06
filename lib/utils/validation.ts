// ============================================================
// 请求数据校验 —— 运动员管理系统（AMS）
// ============================================================
// 职责：
// 1. 定义所有 API 入参的 Zod Schema
// 2. 与 Prisma Schema 保持同步
// 3. 提供类型安全的解析入口
// ============================================================

import { z } from 'zod';

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
  status: z.enum(['ACTIVE', 'RECOVERING', 'LEFT']).optional(),
});

export const athleteUpdateSchema = athleteCreateSchema.partial();

// ============================================================
// 训练计划
// ============================================================

export const trainingPlanCreateSchema = z.object({
  athleteIds: z.array(z.number().int().positive('运动员ID必须为正整数')).min(1, '请至少选择一名运动员'),
  goal: z.string().max(500, '目标不能超过500个字符').optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'COMPLETED']).optional(),
  items: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(1, '星期几必须为1-7').max(7, '星期几必须为1-7'),
        exerciseId: z.number().int().positive('项目ID必须为正整数'),
        sets: z.number().int().positive('组数必须为正整数'),
        reps: z.number().int().positive('次数必须为正整数'),
        load: z.number().positive('负荷必须为正数').optional().nullable(),
        restSeconds: z.number().int().min(0, '间歇时间不能为负数').max(600, '间歇时间不能超过600秒').optional().nullable(),
        duration: z.number().int().min(1, '时长必须为正整数').max(600, '时长不能超过600分钟').optional().nullable(),
        intensity: z.enum(['低', '中', '高']).optional().nullable(),
        sortOrder: z.number().int().min(0).optional(),
        notes: z.string().max(500, '备注不能超过500个字符').optional().nullable(),
      })
    )
    .min(1, '请至少添加一个练习项目'),
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
  trainingDate: z.string().datetime('训练日期格式不正确'),
  rpe: z.number().int().min(1, 'RPE必须为1-10').max(10, 'RPE必须为1-10').optional().nullable(),
  notes: z.string().max(500, '备注不能超过500个字符').optional().nullable(),
});

// ============================================================
// 体能测试
// ============================================================

export const fitnessTestCreateSchema = z.object({
  name: z.string().min(1, '测试名称不能为空').max(100, '名称不能超过100个字符'),
  category: z.string().min(1, '分类不能为空').max(50, '分类不能超过50个字符'),
  unit: z.string().min(1, '单位不能为空').max(20, '单位不能超过20个字符'),
  direction: z.enum(['HIGHER_BETTER', 'LOWER_BETTER']).optional().nullable(),
  warningThreshold: z.number().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  purpose: z.string().max(500).optional().nullable(),
  applicableGroup: z.string().max(200).optional().nullable(),
  equipment: z.string().max(500).optional().nullable(),
  demoVideoUrl: z.string().url('视频链接格式不正确').max(500).optional().nullable(),
  diagramUrl: z.string().url('图解链接格式不正确').max(500).optional().nullable(),
  scoringStandard: z.string().max(1000).optional().nullable(),
  referenceRange: z.string().max(500).optional().nullable(),
  precautions: z.string().max(1000).optional().nullable(),
});

export const fitnessTestUpdateSchema = fitnessTestCreateSchema.partial();

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
  startDate: z.string().datetime('受伤日期格式不正确'),
  endDate: z.string().datetime('痊愈日期格式不正确').optional().nullable(),
  status: z.enum(['INJURED', 'RECOVERING', 'RETURNED']).optional(),
});

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
  category: z.string().min(1, '分类不能为空').max(30, '分类不能超过30个字符'),
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
  status: z.enum(['DRAFT', 'SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(z.object({
    testId: z.number().int().positive('测试项目ID必须为正整数'),
    sortOrder: z.number().int().min(0).optional(),
    groupName: z.string().max(50).optional().nullable(),
    allocatedMinutes: z.number().int().min(1).max(300).optional().nullable(),
  })).optional(),
  participantIds: z.array(z.number().int().positive()).optional(),
});