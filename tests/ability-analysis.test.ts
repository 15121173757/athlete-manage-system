/**
 * 运动能力分析计算 —— 纯函数单元测试
 * 覆盖：Z 分数（越高越好/越低越好/非法常模）、T 分与夹紧、
 *       单项明细、维度得分、TSA 综合评分、空输入边界。
 */

import { describe, it, expect } from 'vitest';
import {
  computeZScore,
  tScoreFromZ,
  computeItemScore,
  computeTSA,
  roundScore,
  normalCdf,
  percentileFromZ,
  DIRECTION_HIGHER_BETTER,
  DIRECTION_LOWER_BETTER,
  type AbilityScoreItem,
} from '@/lib/modules/fitness/abilityAnalysis';

function item(overrides: Partial<AbilityScoreItem> = {}): AbilityScoreItem {
  return {
    testId: 1,
    testName: '1RM 深蹲',
    category: '力量测试',
    unit: 'kg',
    direction: DIRECTION_HIGHER_BETTER,
    value: 110,
    norm: { normName: '青年组常模', mean: 100, stdDev: 10 },
    ...overrides,
  };
}

describe('computeZScore', () => {
  it('越高越好：Z = (成绩 - 均值) / 标准差', () => {
    expect(computeZScore(110, 100, 10, DIRECTION_HIGHER_BETTER)).toBeCloseTo(1);
    expect(computeZScore(90, 100, 10, DIRECTION_HIGHER_BETTER)).toBeCloseTo(-1);
  });

  it('越低越好：Z 取反（成绩优于均值得正分）', () => {
    // 跑步项目：成绩 90s 优于均值 100s
    expect(computeZScore(90, 100, 10, DIRECTION_LOWER_BETTER)).toBeCloseTo(1);
    expect(computeZScore(110, 100, 10, DIRECTION_LOWER_BETTER)).toBeCloseTo(-1);
  });

  it('标准差非正或数值非法返回 null', () => {
    expect(computeZScore(110, 100, 0, DIRECTION_HIGHER_BETTER)).toBeNull();
    expect(computeZScore(110, 100, -1, DIRECTION_HIGHER_BETTER)).toBeNull();
    expect(computeZScore(NaN, 100, 10, DIRECTION_HIGHER_BETTER)).toBeNull();
    expect(computeZScore(110, NaN, 10, DIRECTION_HIGHER_BETTER)).toBeNull();
  });
});

describe('tScoreFromZ', () => {
  it('T = 50 + 10Z（均值 50、标准差 10）', () => {
    expect(tScoreFromZ(0)).toBe(50);
    expect(tScoreFromZ(1)).toBe(60);
    expect(tScoreFromZ(-2)).toBe(30);
  });

  it('夹紧到 [0, 100]', () => {
    expect(tScoreFromZ(5.5)).toBe(100);
    expect(tScoreFromZ(-6)).toBe(0);
  });
});

describe('normalCdf / percentileFromZ', () => {
  it('标准正态累积分布函数 Φ(z) 关键值', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 2);
  });

  it('百分等级 = Φ(Z) × 100，保留一位小数', () => {
    expect(percentileFromZ(0)).toBe(50);
    expect(percentileFromZ(1)).toBe(84.1);
    expect(percentileFromZ(-1)).toBe(15.9);
    expect(percentileFromZ(1.2)).toBe(88.5);
  });

  it('极端 Z 值（对照统计表关键点）', () => {
    // 标准正态分布常用分位数对照：Φ(-3)=0.1%、Φ(-2)=2.3%、Φ(2)=97.7%、Φ(3)=99.9%
    expect(percentileFromZ(-3)).toBe(0.1);
    expect(percentileFromZ(-2.33)).toBe(1.0);
    expect(percentileFromZ(-2)).toBe(2.3);
    expect(percentileFromZ(1.28)).toBe(90.0);
    expect(percentileFromZ(2)).toBe(97.7);
    expect(percentileFromZ(2.33)).toBe(99.0);
    expect(percentileFromZ(3)).toBe(99.9);
  });
});

describe('computeItemScore', () => {
  it('计算单项 Z 分、T 分与百分位数', () => {
    const s = computeItemScore(item());
    expect(s).not.toBeNull();
    expect(s!.zScore).toBe(1);
    expect(s!.tScore).toBe(60);
    // Z=1 → Φ(1)×100 = 84.1
    expect(s!.percentile).toBe(84.1);
    expect(s!.normName).toBe('青年组常模');
  });

  it('常模非法时返回 null', () => {
    expect(computeItemScore(item({ norm: { normName: 'x', mean: 100, stdDev: 0 } }))).toBeNull();
  });
});

describe('computeTSA', () => {
  it('单维度多测试：维度得分 = 均值，TSA = 维度得分', () => {
    const out = computeTSA([
      item({ testId: 1, category: '力量测试', value: 110 }), // Z=1 → T=60
      item({ testId: 2, category: '力量测试', value: 100 }), // Z=0 → T=50
    ]);
    expect(out.dimensions).toHaveLength(1);
    expect(out.dimensions[0].score).toBe(55);
    expect(out.dimensions[0].itemCount).toBe(2);
    // 维度百分等级 = Φ(Z 平均=0.5) = 69.1；单维度时 TSA 百分等级相同
    expect(out.dimensions[0].percentile).toBe(69.1);
    expect(out.tsa).toBe(55);
    expect(out.percentile).toBe(69.1);
  });

  it('多维度：TSA = 各维度得分等权平均', () => {
    const out = computeTSA([
      item({ testId: 1, category: '力量测试', value: 120 }), // T=70
      item({ testId: 3, category: '速度测试', value: 95 }), // T=45
    ]);
    expect(out.dimensions).toHaveLength(2);
    expect(out.tsa).toBe(57.5);
    expect(out.dimensions[0].score).toBe(70);
    expect(out.dimensions[1].score).toBe(45);
    // 力量 Z=2 → 97.7；速度 Z=-0.5 → 30.9；TSA=57.5 → Φ(0.75) = 77.3
    expect(out.dimensions[0].percentile).toBe(97.7);
    expect(out.dimensions[1].percentile).toBe(30.9);
    expect(out.percentile).toBe(77.3);
  });

  it('无有效条目：dimensions 为空且 tsa/percentile 为 null', () => {
    const out = computeTSA([]);
    expect(out.dimensions).toHaveLength(0);
    expect(out.tsa).toBeNull();
    expect(out.percentile).toBeNull();
  });

  it('无效条目被跳过（常模缺失）', () => {
    const out = computeTSA([
      item({ testId: 1, category: '力量测试', value: 110 }),
      item({ testId: 2, category: '力量测试', value: 100, norm: { normName: 'x', mean: 0, stdDev: 0 } }),
    ]);
    expect(out.dimensions[0].itemCount).toBe(1);
  });

  it('多测试维度（混合方向）：维度百分位 = Φ(显示 Z 算术平均)', () => {
    const out = computeTSA([
      // 越低越好：Z=(4.5-4.2)/0.3=1，T=60
      item({ testId: 1, category: '速度测试', unit: 's', direction: DIRECTION_LOWER_BETTER, value: 4.2, norm: { normName: 'n', mean: 4.5, stdDev: 0.3 } }),
      // 越低越好：Z=(7.2-7.2)/0.4=0，T=50
      item({ testId: 2, category: '速度测试', unit: 's', direction: DIRECTION_LOWER_BETTER, value: 7.2, norm: { normName: 'n', mean: 7.2, stdDev: 0.4 } }),
      // 越高越好：Z=(120-100)/10=2，T=70
      item({ testId: 3, category: '速度测试', unit: 'kg', direction: DIRECTION_HIGHER_BETTER, value: 120, norm: { normName: 'n', mean: 100, stdDev: 10 } }),
    ]);
    expect(out.dimensions[0].itemCount).toBe(3);
    // 维度得分=(60+50+70)/3=60；显示 Z 平均=(1+0+2)/3=1 → Φ(1)=84.1
    expect(out.dimensions[0].score).toBe(60);
    expect(out.dimensions[0].percentile).toBe(84.1);
    // TSA=60 → Φ((60-50)/10)=Φ(1)=84.1
    expect(out.tsa).toBe(60);
    expect(out.percentile).toBe(84.1);
  });

  it('roundScore 保留一位小数', () => {
    expect(roundScore(57.55)).toBe(57.6);
    expect(roundScore(50)).toBe(50);
  });
});

// ============================================================
// 综合 Mock 场景：4 维度 × 4 测试，混合 HIGHER/LOWER_BETTER
// ------------------------------------------------------------
// | 维度       | 测试        | 成绩   | 常模(μ,σ)   | 方向       | Z    | T   |
// |------------|-------------|--------|--------------|------------|------|-----|
// | 力量测试   | 1RM 深蹲    | 118kg  | 100/10       | 越高越好   |  1.8 |  68 |
// | 爆发力测试 | 立定跳远    | 2.56m  | 2.5/0.1      | 越高越好   |  0.6 |  56 |
// | 速度测试   | 30 米冲刺   | 4.2s   | 4.5/0.3      | 越低越好   |  1.0 |  60 |
// | 有氧耐力   | 3000 米跑   | 708s   | 750/30       | 越低越好   |  1.4 |  64 |
// TSA = (68+56+60+64) / 4 = 62
// ============================================================
describe('综合 Mock 场景（多维度混合方向）', () => {
  const mockScenario: AbilityScoreItem[] = [
    item({ testId: 1, testName: '1RM 深蹲', category: '力量测试', unit: 'kg', direction: DIRECTION_HIGHER_BETTER, value: 118, norm: { normName: '青年组常模', mean: 100, stdDev: 10 } }),
    item({ testId: 2, testName: '立定跳远', category: '爆发力测试', unit: 'm', direction: DIRECTION_HIGHER_BETTER, value: 2.56, norm: { normName: '成人常模', mean: 2.5, stdDev: 0.1 } }),
    item({ testId: 3, testName: '30 米冲刺', category: '速度测试', unit: 's', direction: DIRECTION_LOWER_BETTER, value: 4.2, norm: { normName: '速度项目常模', mean: 4.5, stdDev: 0.3 } }),
    item({ testId: 4, testName: '3000 米跑', category: '有氧耐力测试', unit: 's', direction: DIRECTION_LOWER_BETTER, value: 708, norm: { normName: '耐力项目常模', mean: 750, stdDev: 30 } }),
  ];

  it('各单项 Z 分 / T 分与手工计算一致', () => {
    const scores = mockScenario.map((it) => computeItemScore(it)!);
    // 1RM 深蹲：Z=(118-100)/10=1.8，T=68
    expect(scores[0].zScore).toBe(1.8);
    expect(scores[0].tScore).toBe(68);
    // 立定跳远：Z=(2.56-2.5)/0.1=0.6，T=56
    expect(scores[1].zScore).toBe(0.6);
    expect(scores[1].tScore).toBe(56);
    // 30 米冲刺：Z=-(4.2-4.5)/0.3=1.0（越低越好取反），T=60，百分位 Φ(1)=84.1
    expect(scores[2].zScore).toBe(1);
    expect(scores[2].tScore).toBe(60);
    expect(scores[2].percentile).toBe(84.1);
    // 3000 米跑：Z=-(708-750)/30=1.4（越低越好取反），T=64
    expect(scores[3].zScore).toBe(1.4);
    expect(scores[3].tScore).toBe(64);
  });

  it('维度得分与 TSA 综合评分正确', () => {
    const out = computeTSA(mockScenario);
    expect(out.dimensions).toHaveLength(4);
    const byCat = new Map(out.dimensions.map((d) => [d.category, d.score]));
    expect(byCat.get('力量测试')).toBe(68);
    expect(byCat.get('爆发力测试')).toBe(56);
    expect(byCat.get('速度测试')).toBe(60);
    expect(byCat.get('有氧耐力测试')).toBe(64);
    expect(out.tsa).toBe(62);
    // 力量维度 Z=1.8 → Φ=96.4；TSA=62 → Φ(1.2)=88.5
    const str = out.dimensions.find((d) => d.category === '力量测试')!;
    expect(str.percentile).toBe(96.4);
    expect(out.percentile).toBe(88.5);
  });

  it('切换常模（30 米冲刺换精英常模 4.3/0.2）后 TSA 随之变化', () => {
    const switched = mockScenario.map((it) =>
      it.testId === 3
        ? { ...it, norm: { normName: '精英组常模', mean: 4.3, stdDev: 0.2 } }
        : it
    );
    const out = computeTSA(switched);
    const sprint = out.dimensions.find((d) => d.category === '速度测试')!;
    // Z=-(4.2-4.3)/0.2=0.5，T=55
    expect(sprint.items[0].zScore).toBe(0.5);
    expect(sprint.items[0].tScore).toBe(55);
    // TSA=(68+56+55+64)/4=60.75 → 60.8
    expect(out.tsa).toBe(60.8);
  });
});
