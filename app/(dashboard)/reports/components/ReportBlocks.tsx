'use client';

/**
 * 报告数据块渲染组件 —— 报告中心（AMS）
 *
 * 职责：将统一聚合结果（ReportData）中的 KPI / 图表 / 明细表渲染为可视化 UI。
 * 通过 kpi / chart / table 三类原子组件实现「指标选择机制」下的灵活组合，
 * 各组件只依赖统一数据契约，与具体报告类型解耦（模块化设计）。
 */

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ChartBlock, KpiItem, TableBlock } from '@/lib/modules/reports/types';

// 图表系列配色（深色主题下鲜明可辨）
const CHART_COLORS = ['#FF6B35', '#4DD0E1', '#FFD54F', '#81C784', '#BA68C8', '#FF8A80', '#82B1FF'];

const tooltipStyle = {
  backgroundColor: '#132F4C',
  border: '1px solid #1E3A5F',
  borderRadius: 8,
  color: '#E6EDF3',
} as const;

// ============================================================
// KPI 概览指标卡片
// ============================================================

export function KpiGrid({ kpis }: { kpis: KpiItem[] }) {
  if (kpis.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <div
          key={kpi.key}
          className="relative overflow-hidden rounded-ams-lg border border-ams-border bg-gradient-to-br from-ams-surface to-ams-background p-4 shadow-ams-card"
        >
          {/* 科技感装饰线 */}
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-ams-primary to-transparent" />
          <div className="text-xs text-ams-text-muted">{kpi.label}</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums text-ams-text-primary">
              {kpi.value}
            </span>
            {kpi.unit && (
              <span className="text-sm text-ams-text-secondary">{kpi.unit}</span>
            )}
          </div>
          {kpi.sub && <div className="mt-1 text-xs text-ams-text-muted">{kpi.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 图表块
// ============================================================

/** 折线 / 柱状图的公共坐标轴 */
function renderCartesian(chart: ChartBlock) {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
      <XAxis
        dataKey={chart.xKey}
        tick={{ fill: '#8B98A9', fontSize: 11 }}
        stroke="#1E3A5F"
      />
      <YAxis
        tick={{ fill: '#8B98A9', fontSize: 11 }}
        stroke="#1E3A5F"
        allowDecimals={false}
      />
      <Tooltip
        contentStyle={tooltipStyle}
        labelStyle={{ color: '#E6EDF3' }}
        cursor={{ fill: 'rgba(255, 107, 53, 0.08)' }}
      />
      <Legend wrapperStyle={{ color: '#8B98A9', fontSize: 12 }} />
    </>
  );
}

export function ChartBlockView({ chart }: { chart: ChartBlock }) {
  const hasData = chart.data.length > 0;

  return (
    <div className="rounded-ams-lg border border-ams-border bg-ams-surface p-4 shadow-ams-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ams-text-primary">{chart.label}</h3>
      </div>
      <div className="h-72 w-full">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-sm text-ams-text-muted">
            暂无数据
          </div>
        ) : chart.type === 'pie' ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chart.data}
                dataKey={chart.series[0]}
                nameKey={chart.xKey}
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={45}
                paddingAngle={2}
                label={({ name, percent }: { name: string; percent: number }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {chart.data.map((_, idx) => (
                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#E6EDF3' }} />
              <Legend wrapperStyle={{ color: '#8B98A9', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : chart.type === 'line' ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart.data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              {renderCartesian(chart)}
              {chart.series.map((s, idx) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CHART_COLORS[idx % CHART_COLORS.length], strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart.data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              {renderCartesian(chart)}
              {chart.series.map((s, idx) => (
                <Bar
                  key={s}
                  dataKey={s}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 明细表块
// ============================================================

export function TableBlockView({ table }: { table: TableBlock }) {
  if (table.rows.length === 0) {
    return (
      <div className="rounded-ams-lg border border-ams-border bg-ams-surface p-4 shadow-ams-card">
        <h3 className="mb-3 text-sm font-semibold text-ams-text-primary">{table.label}</h3>
        <div className="py-8 text-center text-sm text-ams-text-muted">暂无数据</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-ams-lg border border-ams-border bg-ams-surface shadow-ams-card">
      <div className="border-b border-ams-border px-4 py-3">
        <h3 className="text-sm font-semibold text-ams-text-primary">{table.label}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ams-border">
              {table.columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-4 py-3 text-left ams-table-header"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b border-ams-border/50 hover:bg-ams-surface-hover"
              >
                {table.columns.map((col) => {
                  const v = row[col.key];
                  return (
                    <td
                      key={col.key}
                      className="whitespace-nowrap px-4 py-3 text-ams-text-secondary"
                    >
                      {v == null || v === '' ? '-' : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
