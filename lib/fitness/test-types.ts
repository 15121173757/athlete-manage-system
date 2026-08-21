/**
 * 测试库分类定义 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 集中管理体能测试（测试库 fitness_tests）的标准分类体系
 * 2. 提供「历史短分类 → 标准分类」的归一化映射
 * 3. 区分测试库与练习库（exercises）的分类体系，供创建测试计划等项目
 *    选择场景在数据筛选环节做条件判断，确保界面仅呈现测试库项目及其分类
 *
 * 说明：该文件为纯数据/类型模块，可同时被前端组件与服务端逻辑引用，
 * 不得引入 prisma、node 内置模块等运行环境相关依赖。
 */

import { EXERCISE_CATEGORIES } from '@/lib/exercise/track-types';

/**
 * 测试库标准分类（与测试库管理端 categories 保持一致）
 *
 * 标准 11 分类体系：
 * - 力量测试 / 爆发力测试 / 速度测试 / 敏捷测试
 * - 有氧耐力测试 / 无氧耐力测试 / 平衡稳定测试
 * - 灵活性测试 / 肌耐力测试 / 人体测量学
 * - 技术技能测试（专项运动技能，如篮球运球/投篮/传球）
 */
export const FITNESS_TEST_CATEGORIES = [
  '力量测试',
  '爆发力测试',
  '速度测试',
  '敏捷测试',
  '有氧耐力测试',
  '无氧耐力测试',
  '平衡稳定测试',
  '灵活性测试',
  '肌耐力测试',
  '人体测量学',
  '技术技能测试',
] as const;

export type FitnessTestCategory = (typeof FITNESS_TEST_CATEGORIES)[number];

/**
 * 历史短分类 → 标准分类映射
 *
 * 早期测试库曾使用练习库风格短分类（力量/爆发力/速度/耐力/柔韧）录入测试项目，
 * 为保证测试项目选择仅呈现测试库分类体系，这里将历史数据归一化到标准分类。
 */
export const TEST_CATEGORY_LEGACY_MAP: Record<string, string> = {
  力量: '力量测试',
  爆发力: '爆发力测试',
  速度: '速度测试',
  敏捷: '敏捷测试',
  耐力: '有氧耐力测试',
  柔韧: '灵活性测试',
  身体成分: '人体测量学',
};

/** 归一化测试分类：历史短分类映射到标准分类，其余原样返回 */
export function normalizeTestCategory(category: string): string {
  return TEST_CATEGORY_LEGACY_MAP[category] ?? category;
}

/** 判断分类是否属于练习库分类（数据筛选环节用于严格排除练习库分类） */
export function isExerciseCategory(category: string): boolean {
  return (EXERCISE_CATEGORIES as readonly string[]).includes(category);
}

/**
 * 测试标准（常模）条目
 *
 * 单个常模组包含三个统计量：
 * - normName：常模名称（字符串，必填，1-50 字符）
 * - mean：平均值（数字，必填，最多保留两位小数）
 * - stdDev：标准差（数字，必填，大于 0，最多保留两位小数）
 *
 * 测试项目的标准以该结构的数组形式持久化（standards 字段），
 * 与后端 API 请求/响应数据格式保持一致。
 */
export interface TestStandard {
  normName: string;
  mean: number;
  stdDev: number;
}
