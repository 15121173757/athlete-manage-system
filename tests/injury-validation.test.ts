/**
 * 伤病数据校验 —— 单元测试
 * 覆盖 injuryCreateSchema / injuryUpdateSchema 的必填、格式、长度与部分更新规则
 */

import { describe, it, expect } from 'vitest';
import { injuryCreateSchema, injuryUpdateSchema } from '@/lib/utils/validation';

const validInput = {
  athleteId: 1,
  injuryType: '韧带拉伤',
  description: '右膝前交叉韧带拉伤',
  bodyPart: '右膝',
  cause: '训练强度过大',
  diagnosis: '前交叉韧带轻度撕裂',
  treatment: '休息制动、康复训练计划',
  startDate: '2026-08-01T00:00:00.000Z',
};

describe('injuryCreateSchema 伤病创建校验', () => {
  it('合法输入应通过校验', () => {
    const result = injuryCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('endDate 可选且可为 null，status 默认 INJURED', () => {
    const withEndDate = { ...validInput, endDate: '2026-09-01T00:00:00.000Z', status: 'RECOVERING' };
    const result = injuryCreateSchema.safeParse(withEndDate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('RECOVERING');
      expect(result.data.endDate).toBe('2026-09-01T00:00:00.000Z');
    }
  });

  it('缺少受伤人员 athleteId 应报错', () => {
    const { athleteId, ...rest } = validInput;
    const result = injuryCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('缺少受伤部位 bodyPart 应报错（必填字段）', () => {
    const { bodyPart, ...rest } = validInput;
    const result = injuryCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('缺少受伤原因 cause 应报错（必填字段）', () => {
    const { cause, ...rest } = validInput;
    const result = injuryCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('缺少诊断结果 diagnosis 应报错（必填字段）', () => {
    const { diagnosis, ...rest } = validInput;
    const result = injuryCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('缺少治疗方案 treatment 应报错（必填字段）', () => {
    const { treatment, ...rest } = validInput;
    const result = injuryCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('缺少伤病类型 injuryType 应报错', () => {
    const { injuryType, ...rest } = validInput;
    const result = injuryCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('缺少描述 description 应报错', () => {
    const { description, ...rest } = validInput;
    const result = injuryCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('受伤日期 startDate 非 ISO 格式应报错', () => {
    const bad = { ...validInput, startDate: '2026-08-01' };
    const result = injuryCreateSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('伤病类型超过 100 字符应报错', () => {
    const bad = { ...validInput, injuryType: '伤'.repeat(101) };
    const result = injuryCreateSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('治疗方案超过 1000 字符应报错', () => {
    const bad = { ...validInput, treatment: '治'.repeat(1001) };
    const result = injuryCreateSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('无效状态值应报错', () => {
    const bad = { ...validInput, status: 'UNKNOWN' };
    const result = injuryCreateSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('injuryUpdateSchema 伤病更新校验', () => {
  it('部分字段更新应通过（partial 语义）', () => {
    const result = injuryUpdateSchema.safeParse({ diagnosis: '前交叉韧带II度撕裂' });
    expect(result.success).toBe(true);
  });

  it('空对象应通过（表示无变更）', () => {
    const result = injuryUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('更新字段沿用创建校验规则（长度/格式）', () => {
    const badDate = injuryUpdateSchema.safeParse({ startDate: '2026-01-01' });
    expect(badDate.success).toBe(false);

    const longText = injuryUpdateSchema.safeParse({ treatment: '治'.repeat(1001) });
    expect(longText.success).toBe(false);
  });
});
