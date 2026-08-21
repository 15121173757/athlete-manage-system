'use client';

/**
 * 运动科学工具箱 —— /tools
 * 与「体能训练管理」「体能测试管理」「伤病与负荷监控」同级的独立业务模块
 *
 * 界面设计：移除页头与 Tab 导航条，仅保留工具卡片，
 * 卡片自适应布局充分利用可用空间；点击卡片进入对应工具（带返回入口）。
 */
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  Gauge,
  HeartPulse,
  TrendingUp,
  Video,
} from 'lucide-react';
import { HRIntensityTool } from './components/HRIntensityTool';
import { FVPProfileTool } from './components/FVPProfileTool';
import { OneRMProfileTool } from './components/OneRMProfileTool';
import { NeedsAnalysisTool } from './components/NeedsAnalysisTool';
import { VO2maxTool } from './components/VO2maxTool';
import { MovementScreenTool } from './components/MovementScreenTool';
import { JumpAnalysisTool } from './components/JumpAnalysisTool';

const TOOLS = [
  {
    key: 'hr-intensity',
    name: '基于心率的训练强度设定',
    icon: HeartPulse,
    desc: '根据年龄、静息心率等信息，通过三种专业模型自动计算各级别训练心率范围，辅助教练科学设定训练强度。',
    models: ['Karvonen 模型', 'Joe Friel 模型', 'Max HR 模型'],
    status: '已上线',
  },
  {
    key: 'fvp-profile',
    name: 'FVP Profile（力-速度-功率剖面）',
    icon: Gauge,
    desc: '基于 MORIN 团队研究，通过力-速度-功率剖面评估运动员加速与爆发能力，识别力量/速度缺陷并给出个体化训练建议。',
    models: ['冲刺型', '团队型', '跳跃型'],
    status: '已上线',
  },
  {
    key: 'one-rm',
    name: '1RM 最大力量预测',
    icon: Dumbbell,
    desc: '支持传统法（重量 × 次数，6 个循证公式综合）与速度法（VBT 速度-负荷回归外推）两种方式预测最大力量，并自动生成 %1RM 训练负荷处方。',
    models: ['传统法（6 公式）', '速度法（VBT）'],
    status: '已上线',
  },
  {
    key: 'needs-analysis',
    name: '运动需求分析',
    icon: ClipboardList,
    desc: '引导式 5 步多维度评估（个人特点/专项需求/伤病风险/心理状态/生活方式），生成数据支持的标准化分析报告，为制定个性化体能训练计划提供依据。',
    models: ['5 维度评估', '专项需求画像', '报告导出'],
    status: '已上线',
  },
  {
    key: 'vo2max',
    name: 'VO₂max 最大摄氧量估算',
    icon: TrendingUp,
    desc: '通过 5 种循证现场测试法（Cooper 12 分钟跑/1.5 英里跑/6 分钟步行/Astrand 踏车/Bruce 跑台）估算最大摄氧量，输出有氧能力分级、%VO₂max 训练强度带与报告导出。',
    models: ['5 种现场测试法', 'ACSM 分级', '强度带处方'],
    status: '已上线',
  },
  {
    key: 'movement-screen',
    name: 'FMS 功能性动作筛查',
    icon: Activity,
    desc: '基于 Gray Cook 体系的 7 大基础动作筛查（深蹲/跨栏步/弓步蹲/肩部灵活/直腿抬高/俯卧撑/旋转稳定），0-3 分评分、总分 21 分，输出风险分级、左右不对称检测与逐项改进建议，支持批量导入导出。',
    models: ['7 动作评分', '左右不对称检测', '批量导入导出'],
    status: '已上线',
  },
  {
    key: 'jump-analysis',
    name: '跳跃视频分析',
    icon: Video,
    desc: '上传离线拍摄的慢动作跳跃视频（120/240fps），逐帧标记起跳与落地，基于飞行时间法自动计算跳跃高度（h = g·t²/8）、飞行时间、起跳速度，DJ 额外输出触地时间与反应力量指数（RSI），支持 10-5 重复跳跃测试与历史趋势追踪。',
    models: ['CMJ/SJ/DJ/10-5', '飞行时间法', 'RSI 反应力量指数'],
    status: '已上线',
  },
];

function ToolsModuleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 兼容旧参数 ?tab=hr-intensity，新入口使用 ?tool=
  const activeTool =
    searchParams.get('tool') ||
    (searchParams.get('tab') === 'hr-intensity' ? 'hr-intensity' : '');

  /** 单个工具卡片的内容（icon/名称/描述/模型标签/状态） */
  const renderToolBody = (tool: (typeof TOOLS)[number], wide: boolean) => (
    <>
      <div
        className={`flex shrink-0 items-center justify-center rounded-ams bg-ams-primary/15 text-ams-primary ${
          wide ? 'h-14 w-14' : 'mb-4 h-12 w-12'
        }`}
      >
        <tool.icon className={wide ? 'h-7 w-7' : 'h-6 w-6'} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-ams-text-primary">
            {tool.name}
          </h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-ams-success/15 px-2.5 py-0.5 text-xs font-medium text-ams-success">
            <CheckCircle2 className="h-3 w-3" />
            {tool.status}
          </span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-ams-text-secondary">
          {tool.desc}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tool.models.map((m) => (
            <span
              key={m}
              className="rounded-full border border-ams-border bg-ams-background/60 px-2 py-0.5 text-xs text-ams-text-secondary"
            >
              {m}
            </span>
          ))}
        </div>
      </div>
      <span
        className={`flex shrink-0 items-center gap-1 text-sm font-medium text-ams-primary ${
          wide ? '' : 'mt-4'
        }`}
      >
        进入工具
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </>
  );

  return (
    <div>
      {activeTool ? (
        <div className="space-y-4">
          {/* 返回入口：保证进入工具后仍可返回卡片列表 */}
          <button
            type="button"
            onClick={() => router.push('?')}
            className="inline-flex items-center gap-1.5 rounded-ams px-2 py-1 text-sm text-ams-text-secondary transition-colors hover:bg-ams-surface-hover hover:text-ams-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            返回工具箱
          </button>

          {activeTool === 'hr-intensity' && <HRIntensityTool />}
          {activeTool === 'fvp-profile' && <FVPProfileTool />}
          {activeTool === 'one-rm' && <OneRMProfileTool />}
          {activeTool === 'needs-analysis' && <NeedsAnalysisTool />}
          {activeTool === 'vo2max' && <VO2maxTool />}
          {activeTool === 'movement-screen' && <MovementScreenTool />}
          {activeTool === 'jump-analysis' && <JumpAnalysisTool />}
        </div>
      ) : TOOLS.length === 1 ? (
        /* 仅一个工具时：全宽横条卡片，充分利用可用空间 */
        <button
          type="button"
          onClick={() => router.push(`?tool=${TOOLS[0].key}`)}
          className="ams-card ams-card-hover group flex w-full flex-col gap-4 p-6 text-left transition-colors md:flex-row md:items-center"
        >
          {renderToolBody(TOOLS[0], true)}
        </button>
      ) : (
        /* 多工具时：自适应网格布局 */
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {TOOLS.map((tool) => (
            <button
              key={tool.key}
              onClick={() => router.push(`?tool=${tool.key}`)}
              className="ams-card ams-card-hover group flex flex-col p-6 text-left transition-colors"
            >
              {renderToolBody(tool, false)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ToolsModulePage() {
  return (
    <Suspense>
      <ToolsModuleContent />
    </Suspense>
  );
}
