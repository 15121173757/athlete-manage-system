'use client';

/**
 * 基于心率的训练强度设定工具
 * 支持 Karvonen / Joe Friel / Max HR 三种模型
 */
import { useState, useEffect, useMemo } from 'react';
import { HeartPulse, Info, AlertTriangle } from 'lucide-react';
import {
  HR_MODELS,
  calculateHRZones,
  validateHRInputs,
  type HRModel,
} from '@/lib/sport-science/hr-intensity';

interface Athlete {
  id: number;
  name: string;
  birthDate: string;
}

/** 按出生日期计算年龄 */
function ageFromBirth(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

/** 心率范围展示文本 */
function hrRangeText(hrMin: number | null, hrMax: number | null): string {
  if (hrMin == null && hrMax != null) return `≤ ${hrMax}`;
  if (hrMax == null && hrMin != null) return `≥ ${hrMin}`;
  return `${hrMin}–${hrMax}`;
}

/** 级别配色（与系统主题一致） */
const ZONE_COLORS = [
  'border-ams-success/60 text-ams-success',
  'border-ams-info/60 text-ams-info',
  'border-ams-warning/60 text-ams-warning',
  'border-ams-primary/60 text-ams-primary',
  'border-ams-danger/60 text-ams-danger',
];

const inputCls =
  'w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary';

export function HRIntensityTool() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteId, setAthleteId] = useState('');
  const [age, setAge] = useState('');
  const [restHR, setRestHR] = useState('');
  const [lthr, setLthr] = useState('');
  const [model, setModel] = useState<HRModel>('karvonen');

  useEffect(() => {
    fetch('/api/athletes?pageSize=200')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setAthletes(j.data.athletes || j.data || []);
        }
      })
      .catch(() => { /* 运动员列表加载失败不影响手动输入 */ });
  }, []);

  /** 选择运动员后自动填充年龄 */
  const handleAthleteSelect = (id: string) => {
    setAthleteId(id);
    const a = athletes.find((x) => String(x.id) === id);
    if (a) setAge(String(ageFromBirth(a.birthDate)));
  };

  const filled = age.trim() !== '' && restHR.trim() !== '';

  const errors = useMemo(() => {
    if (!filled) return [] as string[];
    return validateHRInputs(model, {
      age: Number(age),
      restHR: Number(restHR),
      lthr: lthr.trim() === '' ? null : Number(lthr),
    });
  }, [model, age, restHR, lthr, filled]);

  const result = useMemo(() => {
    if (errors.length > 0) return null;
    return calculateHRZones(model, {
      age: Number(age),
      restHR: Number(restHR),
      lthr: lthr.trim() === '' ? null : Number(lthr),
    });
  }, [model, age, restHR, lthr, errors]);

  const activeModel = HR_MODELS.find((m) => m.key === model)!;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* ============ 左：输入区 ============ */}
      <div className="space-y-6 lg:col-span-2">
        {/* 运动员个人信息 */}
        <section className="ams-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-ams-primary" />
            <h3 className="text-sm font-semibold text-ams-text-primary">运动员个人信息</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">选择运动员（可选）</label>
              <select
                value={athleteId}
                onChange={(e) => handleAthleteSelect(e.target.value)}
                className={inputCls}
              >
                <option value="">手动填写年龄</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ams-text-muted">选择运动员后将自动带入其年龄</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">
                年龄 <span className="text-ams-danger">*</span>
              </label>
              <input
                type="number"
                min={10}
                max={100}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="如：25"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-ams-text-muted">
                最大心率按 HRmax = 208 −（0.7 × 年龄）计算
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">
                静息心率（次/分）<span className="text-ams-danger">*</span>
              </label>
              <input
                type="number"
                min={30}
                max={200}
                value={restHR}
                onChange={(e) => setRestHR(e.target.value)}
                placeholder="如：60"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-ams-text-muted">建议早晨清醒静卧时测量</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ams-text-primary">
                阈值心率 LTHR（次/分，可选）
              </label>
              <input
                type="number"
                min={60}
                max={250}
                value={lthr}
                onChange={(e) => setLthr(e.target.value)}
                placeholder="留空按 HRmax × 90% 估算"
                className={inputCls}
                disabled={model !== 'friel'}
              />
              <p className="mt-1 text-xs text-ams-text-muted">
                仅 Joe Friel 模型使用；留空时按 HRmax × 90% 估算
              </p>
            </div>
          </div>
        </section>

        {/* 模型选择 */}
        <section className="ams-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Info className="h-4 w-4 text-ams-primary" />
            <h3 className="text-sm font-semibold text-ams-text-primary">选择计算模型</h3>
          </div>
          <div className="space-y-2.5">
            {HR_MODELS.map((m) => {
              const selected = model === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setModel(m.key)}
                  aria-pressed={selected}
                  className={`w-full rounded-ams border p-3 text-left transition-colors duration-150 ${
                    selected
                      ? 'border-ams-primary bg-ams-primary/10'
                      : 'border-ams-border/60 bg-ams-surface hover:border-ams-primary/50 hover:bg-ams-surface-hover'
                  }`}
                >
                  <div className={`flex items-center justify-between text-sm font-medium ${selected ? 'text-ams-primary' : 'text-ams-text-primary'}`}>
                    {m.name}
                    <span className={`h-3.5 w-3.5 rounded-full border-2 ${selected ? 'border-ams-primary bg-ams-primary' : 'border-ams-text-muted'}`} />
                  </div>
                  <div className="mt-1 text-xs text-ams-text-secondary">{m.formula}</div>
                </button>
              );
            })}
          </div>
          <p className="mt-3 rounded-ams border border-ams-border/60 bg-ams-background/60 p-3 text-xs leading-relaxed text-ams-text-secondary">
            {activeModel.name}：{activeModel.desc}
          </p>
        </section>
      </div>

      {/* ============ 右：计算结果 ============ */}
      <div className="lg:col-span-3">
        <section className="ams-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-ams-primary" />
            <h3 className="text-sm font-semibold text-ams-text-primary">训练强度心率区间</h3>
          </div>

          {!filled ? (
            <div className="flex flex-col items-center justify-center rounded-ams border border-dashed border-ams-border py-14 text-center">
              <HeartPulse className="mb-2 h-8 w-8 text-ams-text-muted" />
              <p className="text-sm text-ams-text-secondary">请先填写年龄与静息心率</p>
              <p className="mt-1 text-xs text-ams-text-muted">选择左侧模型后将自动实时计算</p>
            </div>
          ) : errors.length > 0 ? (
            <div className="space-y-2">
              {errors.map((msg) => (
                <div key={msg} className="flex items-start gap-2 rounded-ams border border-ams-danger/40 bg-ams-danger/10 px-3 py-2 text-sm text-ams-danger">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {msg}
                </div>
              ))}
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* 关键参数摘要 */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
                  <div className="text-xs text-ams-text-muted">最大心率 HRmax</div>
                  <div className="mt-1 text-lg font-semibold text-ams-primary">{result.hrMax} <span className="text-xs font-normal text-ams-text-secondary">次/分</span></div>
                </div>
                {model === 'friel' && (
                  <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
                    <div className="text-xs text-ams-text-muted">阈值心率 LTHR{result.lthrEstimated ? '（估算）' : ''}</div>
                    <div className="mt-1 text-lg font-semibold text-ams-text-primary">{result.lthrUsed} <span className="text-xs font-normal text-ams-text-secondary">次/分</span></div>
                  </div>
                )}
                <div className="rounded-ams border border-ams-border/60 bg-ams-background/60 p-3">
                  <div className="text-xs text-ams-text-muted">静息心率</div>
                  <div className="mt-1 text-lg font-semibold text-ams-text-primary">{restHR} <span className="text-xs font-normal text-ams-text-secondary">次/分</span></div>
                </div>
              </div>

              {model === 'friel' && result.lthrEstimated && (
                <p className="text-xs text-ams-text-muted">
                  提示：未填写阈值心率，已按 HRmax × 90% 估算（{result.hrMax} × 0.9 = {result.lthrUsed} 次/分）。如需更精准结果，请填写实测 LTHR。
                </p>
              )}

              {/* 强度级别表格 */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="ams-table-header">
                      <th className="px-3 py-2 text-left">强度级别</th>
                      <th className="px-3 py-2 text-left">强度区间</th>
                      <th className="px-3 py-2 text-left">心率范围（次/分）</th>
                      <th className="px-3 py-2 text-left">训练强度说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.zones.map((z, idx) => (
                      <tr key={z.name} className="border-t border-ams-border/50">
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ZONE_COLORS[idx % ZONE_COLORS.length]}`}>
                            {z.name}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-ams-text-secondary whitespace-nowrap">{z.pctLabel}</td>
                        <td className="px-3 py-2.5 text-ams-text-primary whitespace-nowrap font-medium">
                          {hrRangeText(z.hrMin, z.hrMax)} 次/分
                        </td>
                        <td className="px-3 py-2.5 text-ams-text-secondary leading-relaxed">{z.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs leading-relaxed text-ams-text-muted">
                说明：以上强度区间按 {activeModel.name}（{activeModel.formula}）计算。实际训练中建议结合自感用力程度（RPE）与主观体感综合把控强度，如有心血管疾病史请在专业人员指导下训练。
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
