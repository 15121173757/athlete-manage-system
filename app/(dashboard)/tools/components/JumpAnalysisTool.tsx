'use client';

/**
 * 跳跃视频分析工具（Jump Analysis Tool）
 *
 * 基于「飞行时间法」（h = g·t²/8）：
 * - 上传离线拍摄的跳跃视频（建议 120/240fps 慢动作）
 * - 逐帧导航，手动标记起跳/落地帧
 * - 实时计算跳跃高度、飞行时间、起跳速度（DJ 额外：触地时间、RSI；10-5：平均/最佳/变异系数）
 * - 结果保存至数据库，关联运动员，支持历史趋势查看
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Save,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  JUMP_TEST_TYPES,
  computeSingleJumpMetrics,
  durationToFrameCount,
  getJumpTestTypeMeta,
  summarizeRepeatJumps,
  timeToFrameIndex,
  type JumpTestType,
} from '@/lib/sport-science/jump-analysis';

// ============================================================
// 类型定义
// ============================================================

interface Athlete {
  id: number;
  name: string;
  sport: string;
  weight: number | null;
}

interface HistoryItem {
  id: number;
  athleteId: number;
  athleteName: string;
  athleteSport: string;
  testType: string;
  testDate: string;
  videoName: string | null;
  videoFps: number | null;
  flightTimeMs: number | null;
  jumpHeightCm: number | null;
  takeoffVelocity: number | null;
  contactTimeMs: number | null;
  rsi: number | null;
  dropHeightCm: number | null;
  jumpCount: number | null;
  avgHeightCm: number | null;
  bestHeightCm: number | null;
  avgRsi: number | null;
  rsiCv: number | null;
  notes: string | null;
  createdAt: string;
}

/** 10-5 重复跳：每一跳的标记 */
interface JumpMark {
  takeoffMs: number | null;
  landingMs: number | null;
}

interface SingleResult {
  flightTimeMs: number;
  jumpHeightCm: number;
  takeoffVelocity: number;
  contactTimeMs: number | null;
  rsi: number | null;
}

interface RepeatResult {
  jumpCount: number;
  avgHeightCm: number;
  bestHeightCm: number;
  avgRsi: number | null;
  rsiCv: number | null;
  avgRsiMod: number | null;
  rsiModCv: number | null;
  details: {
    index: number;
    flightTimeMs: number;
    jumpHeightCm: number;
    contactTimeMs: number | null;
    rsi: number | null;
    rsiMod: number | null;
  }[];
}

// ============================================================
// 常量与工具
// ============================================================

const inputCls =
  'w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary';

const tooltipStyle = {
  backgroundColor: '#132F4C',
  border: '1px solid #1E3A5F',
  borderRadius: 8,
  fontSize: 12,
  color: '#E6EDF3',
};

const FPS_OPTIONS = [30, 60, 120, 240];
const DEFAULT_FPS = 120;
const REPEAT_JUMP_COUNT = 10;
/** 长按「上一帧/下一帧」时视频播放倍速（正常速度的 0.5 倍） */
const HOLD_PLAYBACK_RATE = 0.5;
/** 长按判定阈值（≤300ms 响应要求） */
const HOLD_THRESHOLD_MS = 250;

/** 毫秒 → 可读时间（mm:ss.mmm） */
function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = ms - m * 60000;
  return `${String(m).padStart(2, '0')}:${String(Math.floor(rem / 1000)).padStart(2, '0')}.${String(Math.round(rem % 1000)).padStart(3, '0')}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 标记点状态（单跳 / DJ 共用） */
type MarkKey = 'contact' | 'takeoff' | 'landing';
const MARK_LABELS: Record<MarkKey, { label: string; hint: string; color: string }> = {
  contact: { label: '触地', hint: '从跳箱落下首次触地', color: '#38BDF8' },
  takeoff: { label: '起跳', hint: '双脚离地瞬间', color: '#00E5A0' },
  landing: { label: '落地', hint: '任一脚触地瞬间', color: '#F59E0B' },
};

// ============================================================
// 主组件
// ============================================================

export function JumpAnalysisTool() {
  const videoRef = useRef<HTMLVideoElement>(null);

  // 「上一帧/下一帧」长按 0.5 倍速连续播放控制
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdingRef = useRef(false);
  const pressHandledRef = useRef(false);
  /** 长按播放方向：'forward' 正向 0.5 倍速 / 'reverse' 反向 0.5 倍速 */
  const holdDirRef = useRef<'forward' | 'reverse' | null>(null);
  /** 反向播放的 requestAnimationFrame 句柄 */
  const reverseRafRef = useRef<number | null>(null);

  // ---- 测试配置 ----
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteId, setAthleteId] = useState<number | ''>('');
  const [testType, setTestType] = useState<JumpTestType>('CMJ');
  const [testDate, setTestDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  /** 下落高度（cm，DJ 跳深测试参数） */
  const [dropHeightCm, setDropHeightCm] = useState('');

  // ---- 视频 ----
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState('');
  const [videoDurationMs, setVideoDurationMs] = useState(0);
  const [fps, setFps] = useState(DEFAULT_FPS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  // ---- 标记 ----
  /** 单跳多跳（CMJ/SJ/DJ 连续 1-3 次）：每组一次跳跃的标记 */
  const [singleJumpCount, setSingleJumpCount] = useState(1);
  const [singleMarks, setSingleMarks] = useState<Partial<Record<MarkKey, number>>[]>([{}]);
  const [jumps, setJumps] = useState<JumpMark[]>(() =>
    Array.from({ length: REPEAT_JUMP_COUNT }, () => ({ takeoffMs: null, landingMs: null }))
  );
  const [activeJumpIndex, setActiveJumpIndex] = useState(0);

  // ---- 保存与历史 ----
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const isRepeat = testType === 'REPEAT_10_5';
  const meta = getJumpTestTypeMeta(testType);

  // ============================================================
  // 数据加载
  // ============================================================

  useEffect(() => {
    fetch('/api/athletes?pageSize=200')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setAthletes(j.data.athletes || j.data || []);
      })
      .catch(() => {});
  }, []);

  const loadHistory = useCallback((aid: number | '') => {
    if (!aid) {
      setHistory([]);
      return;
    }
    fetch(`/api/jump-analysis?athleteId=${aid}&limit=100`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setHistory(j.data || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadHistory(athleteId);
  }, [athleteId, loadHistory]);

  // ============================================================
  // 视频控制
  // ============================================================

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoName(file.name);
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    // 重置标记
    setSingleMarks(Array.from({ length: singleJumpCount }, () => ({})));
    setJumps(Array.from({ length: REPEAT_JUMP_COUNT }, () => ({ takeoffMs: null, landingMs: null })));
    setActiveJumpIndex(0);
    setCurrentTimeMs(0);
    setSavedMsg('');
    setErrorMsg('');
  };

  const seekTo = (ms: number) => {
    const v = videoRef.current;
    if (!v) return;
    const t = Math.min(Math.max(ms, 0), (v.duration || 0) * 1000) / 1000;
    v.currentTime = t;
    setCurrentTimeMs(t * 1000);
  };

  const frameToTime = (frame: number) => Math.max(0, (frame / fps) * 1000);

  /** 逐帧步进（±1 帧，基于用户设定的 fps） */
  const stepFrame = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    const frame = timeToFrameIndex(v.currentTime * 1000, fps) + delta;
    seekTo(frameToTime(frame));
  };

  /** 长按阈值触发后：0.5 倍速连续播放（正向用 playbackRate，反向用 rAF 逐帧回退） */
  const startHoldPlayback = (dir: 'forward' | 'reverse') => {
    holdingRef.current = true;
    holdDirRef.current = dir;
    const v = videoRef.current;
    if (!v) return;
    if (dir === 'forward') {
      // 正向：浏览器原生播放 + 0.5 倍速（playbackRate 仅支持正向）
      v.playbackRate = HOLD_PLAYBACK_RATE;
      v.play().then(() => setIsPlaying(true)).catch(() => {});
      return;
    }
    // 反向：浏览器不支持负 playbackRate，用 rAF 按真实时间差以 0.5 倍速逐帧回退，保持流畅
    let last = performance.now();
    const tick = (now: number) => {
      if (!holdingRef.current || holdDirRef.current !== 'reverse') return;
      const dt = (now - last) / 1000;
      last = now;
      const el = videoRef.current;
      if (el) {
        el.currentTime = Math.max(0, el.currentTime - HOLD_PLAYBACK_RATE * dt);
        setIsPlaying(true);
      }
      reverseRafRef.current = requestAnimationFrame(tick);
    };
    reverseRafRef.current = requestAnimationFrame(tick);
  };

  /** 停止长按：取消 rAF/定时器、暂停、恢复 1 倍速并对齐当前播放帧 */
  const stopHoldPlayback = () => {
    holdingRef.current = false;
    holdDirRef.current = null;
    if (reverseRafRef.current != null) {
      cancelAnimationFrame(reverseRafRef.current);
      reverseRafRef.current = null;
    }
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.playbackRate = 1;
    setIsPlaying(false);
    // 精确定位到当前播放帧画面，确保可准确标记
    const frame = timeToFrameIndex(v.currentTime * 1000, fps);
    const maxFrame = Math.max(durationToFrameCount(videoDurationMs, fps) - 1, 0);
    seekTo(frameToTime(Math.min(frame, maxFrame)));
  };

  /** 「上一帧/下一帧」按下：250ms 内判定为单击，超阈值触发 0.5 倍速连续播放 */
  const handleFrameHoldDown = (dir: 'forward' | 'reverse') => {
    pressHandledRef.current = false;
    holdingRef.current = false;
    holdDirRef.current = null;
    holdTimerRef.current = setTimeout(() => startHoldPlayback(dir), HOLD_THRESHOLD_MS);
  };

  /** 「上一帧/下一帧」松开：长按则停止播放并对齐当前帧；单击则步进一帧 */
  const handleFrameHoldUp = (dir: 'forward' | 'reverse') => {
    if (pressHandledRef.current) return;
    pressHandledRef.current = true;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdingRef.current) {
      stopHoldPlayback();
    } else {
      // 单击：步进一帧（正向 +1 / 反向 -1）
      stepFrame(dir === 'forward' ? 1 : -1);
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  /** 标记当前帧到当前激活的跳跃（单跳多跳模式），完成后自动切换至下一次跳跃 */
  const markCurrentFrame = (key: MarkKey) => {
    const v = videoRef.current;
    if (!v) return;
    const frame = timeToFrameIndex(v.currentTime * 1000, fps);
    const next = singleMarks.map((m, i) => (i === activeJumpIndex ? { ...m, [key]: frameToTime(frame) } : m));
    setSingleMarks(next);
    // 当前跳跃「起跳」+「落地」均已标记且合法 → 自动切换至下一次跳跃
    const cur = next[activeJumpIndex];
    if (cur.takeoff != null && cur.landing != null && cur.landing > cur.takeoff && activeJumpIndex < next.length - 1) {
      setActiveJumpIndex(activeJumpIndex + 1);
    }
    setErrorMsg('');
  };

  const markJump = (slot: 'takeoff' | 'landing', jumpIndex: number) => {
    const v = videoRef.current;
    if (!v) return;
    const frame = timeToFrameIndex(v.currentTime * 1000, fps);
    // 写入键必须与 JumpMark 字段一致（takeoffMs/landingMs），否则回显/自动切换/计算均读取不到
    const field = slot === 'takeoff' ? 'takeoffMs' : 'landingMs';
    const next = jumps.map((j, i) => (i === jumpIndex ? { ...j, [field]: frameToTime(frame) } : j));
    setJumps(next);
    // 当前跳跃「起跳」+「落地」均已标记且合法 → 自动切换至下一次跳跃（10-5 连续标记流程）
    const cur = next[jumpIndex];
    if (cur.takeoffMs != null && cur.landingMs != null && cur.landingMs > cur.takeoffMs && jumpIndex < next.length - 1) {
      setActiveJumpIndex(jumpIndex + 1);
    }
    setErrorMsg('');
  };

  const clearMarks = () => {
    setSingleMarks(Array.from({ length: singleJumpCount }, () => ({})));
    setJumps(Array.from({ length: REPEAT_JUMP_COUNT }, () => ({ takeoffMs: null, landingMs: null })));
    setActiveJumpIndex(0);
    setErrorMsg('');
  };

  /** 当前跳跃是否只标记了「起跳」/「落地」中的一项（未完成） */
  const isHalfMarked = (): boolean => {
    if (isRepeat) {
      const j = jumps[activeJumpIndex];
      return !!j && (j.takeoffMs != null) !== (j.landingMs != null);
    }
    const m = singleMarks[activeJumpIndex];
    return !!m && (m.takeoff != null) !== (m.landing != null);
  };

  /** 若当前跳跃未完成（仅标记起跳/落地中的一项），弹出提示并返回 true 阻止其他操作 */
  const guardHalfMarked = (): boolean => {
    if (isHalfMarked()) {
      setErrorMsg('请完成当前跳跃的标记');
      return true;
    }
    return false;
  };

  /** 修改单跳跳跃次数（1-3），重置单跳标记 */
  const changeSingleJumpCount = (n: number) => {
    if (guardHalfMarked()) return;
    setSingleJumpCount(n);
    setSingleMarks(Array.from({ length: n }, () => ({})));
    setActiveJumpIndex(0);
    setErrorMsg('');
  };

  /** 切换测试类型时重置全部标记 */
  const changeTestType = (t: JumpTestType) => {
    if (guardHalfMarked()) return;
    setTestType(t);
    setSingleJumpCount(1);
    setSingleMarks([{}]);
    setJumps(Array.from({ length: REPEAT_JUMP_COUNT }, () => ({ takeoffMs: null, landingMs: null })));
    setActiveJumpIndex(0);
    setErrorMsg('');
  };

  // ============================================================
  // 计算结果（实时预览）
  // ============================================================

  /** 单跳多跳：每次跳跃的完整指标（含 index；未完成的为 null） */
  const singleResults = useMemo<{ index: number; metrics: SingleResult }[]>(() => {
    if (testType === 'REPEAT_10_5') return [];
    const list: { index: number; metrics: SingleResult }[] = [];
    singleMarks.forEach((m, idx) => {
      const index = idx + 1;
      if (testType === 'DJ') {
        const { contact, takeoff, landing } = m;
        if (takeoff == null || landing == null || landing <= takeoff) return;
        const met = computeSingleJumpMetrics(landing - takeoff, contact != null ? takeoff - contact : null);
        list.push({ index, metrics: met });
      } else {
        const { takeoff, landing } = m;
        if (takeoff == null || landing == null || landing <= takeoff) return;
        const met = computeSingleJumpMetrics(landing - takeoff);
        list.push({ index, metrics: met });
      }
    });
    return list;
  }, [testType, singleMarks]);

  const repeatResult = useMemo<RepeatResult | null>(() => {
    if (!isRepeat) return null;
    const valid = jumps.filter((j) => j.takeoffMs != null && j.landingMs != null && j.landingMs > j.takeoffMs);
    if (valid.length === 0) return null;
    const details = valid.map((j) => ({
      flightTimeMs: j.landingMs! - j.takeoffMs!,
      contactTimeMs: null as number | null, // 触地时间 = 下一跳起跳 - 本跳落地，下方循环补全
    }));
    for (let i = 0; i < valid.length; i++) {
      const next = valid[i + 1];
      if (next) {
        const gap = next.takeoffMs! - valid[i].landingMs!;
        if (gap > 0) details[i].contactTimeMs = gap;
      }
    }
    const summary = summarizeRepeatJumps(details);
    const fullDetails = details.map((d, i) => {
      const m = computeSingleJumpMetrics(d.flightTimeMs, d.contactTimeMs);
      return {
        index: i + 1,
        flightTimeMs: m.flightTimeMs,
        jumpHeightCm: m.jumpHeightCm,
        contactTimeMs: m.contactTimeMs,
        rsi: m.rsi,
        rsiMod: m.rsiMod,
      };
    });
    return {
      jumpCount: summary.jumpCount,
      avgHeightCm: summary.avgHeightCm,
      bestHeightCm: summary.bestHeightCm,
      avgRsi: summary.avgRsi,
      rsiCv: summary.rsiCv,
      avgRsiMod: summary.avgRsiMod,
      rsiModCv: summary.rsiModCv,
      details: fullDetails,
    };
  }, [isRepeat, jumps]);

  // ============================================================
  // 保存
  // ============================================================

  const saveRecord = async () => {
    setErrorMsg('');
    setSavedMsg('');

    if (athleteId === '') {
      setErrorMsg('请先选择运动员');
      return;
    }
    if (!videoUrl) {
      setErrorMsg('请先上传跳跃视频');
      return;
    }
    if (guardHalfMarked()) return;

    // DJ 跳深：下落高度为必填参数（1-200cm 整数）
    let dropHeight: number | null = null;
    if (testType === 'DJ') {
      if (!dropHeightCm) {
        setErrorMsg('请填写下落高度（cm）');
        return;
      }
      const dh = Number(dropHeightCm);
      if (!Number.isInteger(dh) || dh < 1 || dh > 200) {
        setErrorMsg('下落高度需为 1-200cm 之间的整数');
        return;
      }
      dropHeight = dh;
    }

    let payload: Record<string, unknown>;
    if (isRepeat) {
      const valid = repeatResult;
      if (!valid) {
        setErrorMsg('请至少标记 1 次完整的跳跃（起跳+落地）');
        return;
      }
      payload = {
        athleteId,
        testType,
        testDate,
        videoName,
        videoFps: fps,
        dropHeightCm: dropHeight,
        details: valid.details.map((d) => ({
          index: d.index,
          flightTimeMs: d.flightTimeMs,
          contactTimeMs: d.contactTimeMs,
        })),
        notes: notes || null,
      };
    } else {
      if (singleResults.length === 0) {
        setErrorMsg('请先标记起跳与落地帧');
        return;
      }
      // 主指标取「最佳高度」那一跳（与服务端 main 字段语义一致）
      const best = singleResults.reduce((a, b) =>
        b.metrics.jumpHeightCm > a.metrics.jumpHeightCm ? b : a
      );
      payload = {
        athleteId,
        testType,
        testDate,
        videoName,
        videoFps: fps,
        flightTimeMs: best.metrics.flightTimeMs,
        contactTimeMs: best.metrics.contactTimeMs,
        dropHeightCm: dropHeight,
        details: singleResults.map((r) => ({
          index: r.index,
          flightTimeMs: r.metrics.flightTimeMs,
          contactTimeMs: r.metrics.contactTimeMs,
        })),
        notes: notes || null,
      };
    }

    setSaving(true);
    try {
      const res = await fetch('/api/jump-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || '保存失败');
      setSavedMsg('✓ 已保存，跳跃测试结果已入库');
      loadHistory(athleteId as number);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (id: number) => {
    if (!window.confirm('确定删除该条跳跃分析记录吗？')) return;
    try {
      const res = await fetch(`/api/jump-analysis?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || '删除失败');
      loadHistory(athleteId as number);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '删除失败');
    }
  };

  // ============================================================
  // 趋势数据
  // ============================================================

  const trendData = useMemo(() => {
    return history
      .map((h) => {
        const height = h.testType === 'REPEAT_10_5' ? h.avgHeightCm : h.jumpHeightCm;
        return { date: h.testDate.slice(5), height: height ?? null, id: h.id, type: h.testType };
      })
      .filter((d) => d.height != null)
      .reverse();
  }, [history]);

  const historyHeight = (h: HistoryItem): number | null =>
    h.testType === 'REPEAT_10_5' ? h.avgHeightCm : h.jumpHeightCm;

  // ============================================================
  // 渲染辅助
  // ============================================================

  const renderMarks = () => {
    if (isRepeat) {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {jumps.map((j, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (i === activeJumpIndex) return;
                  if (guardHalfMarked()) return;
                  setActiveJumpIndex(i);
                }}
                className={cn(
                  'inline-flex items-center gap-1 rounded-ams border px-2.5 py-1 text-xs transition-colors',
                  activeJumpIndex === i
                    ? 'border-ams-primary bg-ams-primary/15 text-ams-primary'
                    : 'border-ams-border text-ams-text-secondary hover:bg-ams-surface-hover'
                )}
              >
                第 {i + 1} 跳
                {j.takeoffMs != null && j.landingMs != null ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-ams-success" />
                ) : j.takeoffMs != null ? (
                  <span className="h-2 w-2 rounded-full bg-ams-warning" />
                ) : null}
              </button>
            ))}
          </div>
          <p className="text-xs text-ams-text-muted">
            当前：第 {activeJumpIndex + 1} 跳，依次标记「起跳」与「落地」帧
          </p>
          <div className="flex flex-wrap gap-2">
            {(['takeoff', 'landing'] as const).map((slot) => {
              const field = slot === 'takeoff' ? 'takeoffMs' : 'landingMs';
              const val = jumps[activeJumpIndex]?.[field];
              return (
                <div key={slot} className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={slot === 'takeoff' ? 'default' : 'outline'}
                    onClick={() => markJump(slot, activeJumpIndex)}
                  >
                    <Flag className="mr-1 h-3.5 w-3.5" />
                    标记{slot === 'takeoff' ? '起跳' : '落地'}
                  </Button>
                  <span className={cn('text-sm tabular-nums', val != null ? 'text-ams-text-primary' : 'text-ams-text-muted')}>
                    {fmtMs(val)}
                  </span>
                </div>
              );
            })}
          </div>
          {activeJumpIndex < jumps.length - 1 && jumps[activeJumpIndex].landingMs != null && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                if (guardHalfMarked()) return;
                setActiveJumpIndex((i) => Math.min(i + 1, jumps.length - 1));
              }}
            >
              下一跳 →
            </Button>
          )}
        </div>
      );
    }

    const keys: MarkKey[] = testType === 'DJ' ? ['contact', 'takeoff', 'landing'] : ['takeoff', 'landing'];
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ams-text-muted">单次视频跳跃次数：</span>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => changeSingleJumpCount(n)}
              className={cn(
                'rounded-ams border px-2.5 py-1 text-xs transition-colors',
                singleJumpCount === n
                  ? 'border-ams-primary bg-ams-primary/15 text-ams-primary'
                  : 'border-ams-border text-ams-text-secondary hover:bg-ams-surface-hover'
              )}
            >
              {n} 次
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {singleMarks.map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (i === activeJumpIndex) return;
                if (guardHalfMarked()) return;
                setActiveJumpIndex(i);
              }}
              className={cn(
                'inline-flex items-center gap-1 rounded-ams border px-2.5 py-1 text-xs transition-colors',
                activeJumpIndex === i
                  ? 'border-ams-primary bg-ams-primary/15 text-ams-primary'
                  : 'border-ams-border text-ams-text-secondary hover:bg-ams-surface-hover'
              )}
            >
              第 {i + 1} 次
              {m.takeoff != null && m.landing != null ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-ams-success" />
              ) : m.takeoff != null || m.landing != null ? (
                <span className="h-2 w-2 rounded-full bg-ams-warning" />
              ) : null}
            </button>
          ))}
        </div>
        <p className="text-xs text-ams-text-muted">
          当前：第 {activeJumpIndex + 1} 次跳跃，依次标记「起跳」与「落地」帧（播放视频到关键帧后点击标记）
        </p>
        <div className="flex flex-wrap gap-2">
          {keys.map((key) => {
            const cfg = MARK_LABELS[key];
            const val = singleMarks[activeJumpIndex]?.[key];
            return (
              <div key={key} className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={key === 'takeoff' ? 'default' : 'outline'}
                  onClick={() => markCurrentFrame(key)}
                  style={{ borderColor: val != null ? cfg.color : undefined, color: val != null ? cfg.color : undefined }}
                >
                  <Flag className="mr-1 h-3.5 w-3.5" />
                  标记{cfg.label}
                </Button>
                <span className={cn('text-sm tabular-nums', val != null ? 'text-ams-text-primary' : 'text-ams-text-muted')}>
                  {fmtMs(val)}
                </span>
                <span className="text-xs text-ams-text-muted">{cfg.hint}</span>
              </div>
            );
          })}
        </div>
        {activeJumpIndex < singleJumpCount - 1 && singleMarks[activeJumpIndex]?.landing != null && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              if (guardHalfMarked()) return;
              setActiveJumpIndex((i) => Math.min(i + 1, singleJumpCount - 1));
            }}
          >
            下一次跳跃 →
          </Button>
        )}
      </div>
    );
  };

  const renderResult = () => {
    if (isRepeat) {
      if (!repeatResult) {
        return <p className="text-sm text-ams-text-muted">标记至少 1 次完整跳跃后自动计算。</p>;
      }
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultCard label="跳跃次数" value={String(repeatResult.jumpCount)} unit="次" />
            <ResultCard label="平均高度" value={repeatResult.avgHeightCm.toFixed(1)} unit="cm" />
            <ResultCard label="最佳高度" value={repeatResult.bestHeightCm.toFixed(1)} unit="cm" />
            <ResultCard label="平均 RSI" value={repeatResult.avgRsi?.toFixed(2) ?? '—'} unit="" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultCard label="RSI 变异系数" value={repeatResult.rsiCv != null ? repeatResult.rsiCv.toFixed(1) : '—'} unit="%" />
            <ResultCard label="平均 RSI-mod" value={repeatResult.avgRsiMod?.toFixed(2) ?? '—'} unit="" />
            <ResultCard label="RSI-mod 变异系数" value={repeatResult.rsiModCv != null ? repeatResult.rsiModCv.toFixed(1) : '—'} unit="%" />
          </div>
          {repeatResult.details.length >= 2 && (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={repeatResult.details.map((d) => ({ index: d.index, rsi: d.rsi, rsiMod: d.rsiMod }))}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="index"
                    name="跳跃序号"
                    tick={{ fill: '#8B98A9', fontSize: 11 }}
                    axisLine={{ stroke: '#1E3A5F' }}
                    tickLine={{ stroke: '#1E3A5F' }}
                  />
                  <YAxis
                    yAxisId="rsi"
                    tick={{ fill: '#8B98A9', fontSize: 11 }}
                    axisLine={{ stroke: '#1E3A5F' }}
                    tickLine={{ stroke: '#1E3A5F' }}
                    tickFormatter={(v: number) => (Math.round(v) === v ? String(v) : v.toFixed(1))}
                  />
                  <YAxis
                    yAxisId="rsimod"
                    orientation="right"
                    tick={{ fill: '#8B98A9', fontSize: 11 }}
                    axisLine={{ stroke: '#1E3A5F' }}
                    tickLine={{ stroke: '#1E3A5F' }}
                    tickFormatter={(v: number) => (Math.round(v) === v ? String(v) : v.toFixed(1))}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [Number(v).toFixed(2), name]} />
                  <Legend
                    verticalAlign="top"
                    align="center"
                    content={(props) => (
                      <ul className="mx-auto flex w-fit flex-wrap items-center gap-4 pb-2">
                        {(props.payload ?? []).map((entry) => (
                          <li key={String(entry.value)} className="flex items-center gap-1.5 text-xs text-ams-text-secondary">
                            <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                            {entry.value}
                          </li>
                        ))}
                      </ul>
                    )}
                  />
                  <Line yAxisId="rsi" type="monotone" dataKey="rsi" name="RSI" stroke="#00E5A0" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line yAxisId="rsimod" type="monotone" dataKey="rsiMod" name="RSI-mod" stroke="#4FC3F7" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-ams-border text-left text-xs text-ams-text-muted">
                  <th className="py-1.5 pr-2 font-normal">#</th>
                  <th className="py-1.5 pr-2 font-normal">飞行时间</th>
                  <th className="py-1.5 pr-2 font-normal">高度</th>
                  <th className="py-1.5 pr-2 font-normal">触地时间</th>
                  <th className="py-1.5 pr-2 font-normal">RSI</th>
                  <th className="py-1.5 font-normal">RSI-mod</th>
                </tr>
              </thead>
              <tbody>
                {repeatResult.details.map((d) => (
                  <tr key={d.index} className="border-b border-ams-border/50">
                    <td className="py-1.5 pr-2 tabular-nums text-ams-text-secondary">{d.index}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{d.flightTimeMs.toFixed(1)} ms</td>
                    <td className="py-1.5 pr-2 tabular-nums">{d.jumpHeightCm.toFixed(1)} cm</td>
                    <td className="py-1.5 pr-2 tabular-nums">{d.contactTimeMs != null ? `${d.contactTimeMs.toFixed(1)} ms` : '—'}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{d.rsi != null ? d.rsi.toFixed(2) : '—'}</td>
                    <td className="py-1.5 tabular-nums">{d.rsiMod != null ? d.rsiMod.toFixed(2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rounded-ams border border-ams-border bg-ams-background/40 p-3 text-xs leading-relaxed text-ams-text-secondary">
            解读：本次 10-5 重复跳共 {repeatResult.jumpCount} 次有效跳跃，平均高度 {repeatResult.avgHeightCm.toFixed(1)} cm、
            最佳 {repeatResult.bestHeightCm.toFixed(1)} cm。平均 RSI {repeatResult.avgRsi?.toFixed(2) ?? '—'}
            {repeatResult.rsiCv != null ? `（变异系数 ${repeatResult.rsiCv.toFixed(1)}%）` : ''}，
            平均 RSI-mod {repeatResult.avgRsiMod?.toFixed(2) ?? '—'}
            {repeatResult.rsiModCv != null ? `（变异系数 ${repeatResult.rsiModCv.toFixed(1)}%）` : ''}。
            RSI（高度/触地时间）越高说明从地面快速反弹的能力越强；RSI-mod（高度/飞行时间，修正反应力量指数）越高说明单位腾空时间所获高度效率越高。
            两者变异系数越低代表各次跳跃越稳定，若 RSI 高而 RSI-mod 偏低，提示触地时间短但腾空高度相对不足。
          </p>
        </div>
      );
    }

    // 当前激活跳跃的进行中状态（用于分析结果区域实时显示）
    const currentMarks = singleMarks[activeJumpIndex];
    const currentComplete =
      currentMarks != null && currentMarks.takeoff != null && currentMarks.landing != null;
    const currentHasMark =
      currentMarks != null &&
      (currentMarks.takeoff != null ||
        currentMarks.landing != null ||
        (testType === 'DJ' && currentMarks.contact != null));
    const currentIncomplete = currentHasMark && !currentComplete;

    if (singleResults.length === 0 && !currentIncomplete) {
      return <p className="text-sm text-ams-text-muted">标记起跳与落地帧后自动计算。</p>;
    }

    const heights = singleResults.map((r) => r.metrics.jumpHeightCm);
    const bestHeight = Math.max(...heights);
    const bestEntry = singleResults.find((r) => r.metrics.jumpHeightCm === bestHeight)!;
    const avgHeight = heights.reduce((s, v) => s + v, 0) / heights.length;
    const rsiValues = singleResults.map((r) => r.metrics.rsi).filter((v): v is number => v != null);
    const avgRsi = rsiValues.length > 0 ? rsiValues.reduce((s, v) => s + v, 0) / rsiValues.length : null;

    return (
      <div className="space-y-4">
        {/* DJ 测试参数：下落高度 */}
        {testType === 'DJ' && (
          <div className="rounded-ams border border-ams-border bg-ams-background/40 p-3">
            <p className="mb-2 text-xs text-ams-text-muted">测试参数</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ResultCard label="下落高度" value={dropHeightCm ? String(dropHeightCm) : '—'} unit="cm" />
            </div>
          </div>
        )}
        {/* 当前进行中的跳跃（实时更新，未完成） */}
        {currentIncomplete && (
          <div className="rounded-ams border border-dashed border-ams-primary/40 bg-ams-background/40 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-ams-primary/10 px-2 py-0.5 text-xs font-medium text-ams-primary">
                第 {activeJumpIndex + 1} 次跳跃 · 标记中
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {testType === 'DJ' && <ResultCard label="触地" value={fmtMs(currentMarks?.contact)} unit="" />}
              <ResultCard label="起跳" value={fmtMs(currentMarks?.takeoff)} unit="" />
              <ResultCard label="落地" value={fmtMs(currentMarks?.landing)} unit="" />
            </div>
            <p className="mt-2 text-xs text-ams-text-secondary">
              {currentMarks?.takeoff != null && currentMarks?.landing == null
                ? '已标记起跳，请继续标记落地。'
                : currentMarks?.landing != null && currentMarks?.takeoff == null
                  ? '已标记落地，请标记起跳。'
                  : testType === 'DJ'
                    ? '请依次标记触地、起跳与落地。'
                    : '请依次标记起跳与落地。'}
            </p>
          </div>
        )}

        {/* 每次跳跃的量化指标（第 1/2/3 次） */}
        <div className="space-y-3">
          {singleResults.map((r) => {
            const m = r.metrics;
            const isBest = m.jumpHeightCm === bestHeight;
            return (
              <div
                key={r.index}
                className={cn(
                  'rounded-ams border p-3',
                  isBest && singleResults.length > 1
                    ? 'border-ams-primary/50 bg-ams-primary/5'
                    : 'border-ams-border bg-ams-background/40'
                )}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-ams-primary/10 px-2 py-0.5 text-xs font-medium text-ams-primary">
                    第 {r.index} 次跳跃
                  </span>
                  {isBest && singleResults.length > 1 && (
                    <span className="rounded-full bg-ams-success/15 px-2 py-0.5 text-xs font-medium text-ams-success">
                      最佳
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <ResultCard label="飞行时间" value={m.flightTimeMs.toFixed(1)} unit="ms" />
                  <ResultCard label="跳跃高度" value={m.jumpHeightCm.toFixed(1)} unit="cm" highlight={isBest} />
                  <ResultCard label="起跳速度" value={m.takeoffVelocity.toFixed(2)} unit="m/s" />
                  {testType === 'DJ' && (
                    <ResultCard
                      label="触地时间"
                      value={m.contactTimeMs != null ? m.contactTimeMs.toFixed(1) : '—'}
                      unit={m.contactTimeMs != null ? 'ms' : ''}
                    />
                  )}
                  {testType === 'DJ' && m.rsi != null && (
                    <ResultCard label="RSI" value={m.rsi.toFixed(2)} unit="" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 汇总与评估结论 */}
        {singleResults.length > 1 && (
          <div className="rounded-ams border border-ams-border bg-ams-background/40 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <ResultCard label="平均高度" value={avgHeight.toFixed(1)} unit="cm" />
              <ResultCard label="最佳高度" value={bestHeight.toFixed(1)} unit="cm" highlight />
              {avgRsi != null && <ResultCard label="平均 RSI" value={avgRsi.toFixed(2)} unit="" />}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ams-text-secondary">
              评估结论：第 {bestEntry.index} 次跳跃达到最佳高度 {bestHeight.toFixed(1)} cm，
              共 {singleResults.length} 次跳跃的平均高度为 {avgHeight.toFixed(1)} cm。
              {avgRsi != null && ` 平均反应力量指数 RSI ${avgRsi.toFixed(2)}。`}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* ---------- 顶部说明 ---------- */}
      <div className="ams-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ams-text-primary">
              <BarChart3 className="h-5 w-5 text-ams-primary" />
              跳跃视频分析
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ams-text-secondary">
              {meta?.desc}。上传离线拍摄的慢动作视频（建议 {DEFAULT_FPS}+fps），逐帧标记起跳与落地，
              同一视频可连续标记多次跳跃（如 CMJ/SJ/DJ 各测 1-3 次），系统基于飞行时间法自动计算
              跳跃高度（h = g·t²/8）与相关生物力学指标，并分别给出每次跳跃的量化指标与评估结论。
            </p>
          </div>
          <span className="rounded-full bg-ams-primary/15 px-3 py-1 text-xs font-medium text-ams-primary">
            飞行时间法 · 手动帧标记
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* ---------- 左列：配置 + 视频 + 标记 ---------- */}
        <div className="space-y-5">
          {/* 测试配置 */}
          <div className="ams-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-ams-text-primary">测试配置</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-ams-text-secondary">运动员</label>
                <select className={inputCls} value={athleteId} onChange={(e) => setAthleteId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">请选择运动员</option>
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}（{a.sport}）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-ams-text-secondary">测试日期</label>
                <input type="date" className={inputCls} value={testDate} onChange={(e) => setTestDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-ams-text-secondary">跳跃类型</label>
                <div className="flex flex-wrap gap-2">
                  {JUMP_TEST_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => changeTestType(t.value)}
                      className={cn(
                        'rounded-ams border px-3 py-1.5 text-xs font-medium transition-colors',
                        testType === t.value
                          ? 'border-ams-primary bg-ams-primary/15 text-ams-primary'
                          : 'border-ams-border text-ams-text-secondary hover:bg-ams-surface-hover'
                      )}
                    >
                      {t.short}
                    </button>
                  ))}
                </div>
              </div>
              {testType === 'DJ' && (
                <div>
                  <label className="mb-1.5 block text-xs text-ams-text-secondary">
                    下落高度（cm）
                  </label>
                  <input
                    type="number"
                    className={inputCls}
                    min={1}
                    max={200}
                    placeholder="如：40"
                    value={dropHeightCm}
                    onChange={(e) => setDropHeightCm(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-ams-text-muted">跳深测试的跳箱下落高度，整数（1-200cm）</p>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs text-ams-text-secondary">视频帧率（标记精度）</label>
                <select className={inputCls} value={fps} onChange={(e) => setFps(Number(e.target.value))}>
                  {FPS_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f} fps{f < DEFAULT_FPS ? '（精度受限）' : f === DEFAULT_FPS ? '（推荐）' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs text-ams-text-secondary">备注</label>
                <input
                  className={inputCls}
                  placeholder="如：热身 10 分钟后测试、落地站稳等"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 视频上传与播放 */}
          <div className="ams-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-ams-text-primary">视频分析</h3>
            {!videoUrl ? (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-ams border-2 border-dashed border-ams-border bg-ams-background/40 px-4 py-10 text-center transition-colors hover:border-ams-primary/50 hover:bg-ams-surface-hover">
                <Video className="h-8 w-8 text-ams-text-muted" />
                <span className="text-sm font-medium text-ams-text-primary">点击上传跳跃视频</span>
                <span className="text-xs text-ams-text-muted">MP4 / MOV，建议 120-240fps 慢动作，三脚架固定拍摄</span>
                <input type="file" accept="video/*" className="hidden" onChange={handleFile} />
              </label>
            ) : (
              <div className="space-y-3">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="max-h-[340px] w-full rounded-ams border border-ams-border bg-black"
                  playsInline
                  onTimeUpdate={(e) => setCurrentTimeMs(e.currentTarget.currentTime * 1000)}
                  onDurationChange={(e) => setVideoDurationMs(e.currentTarget.duration * 1000)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={togglePlay}>
                    {isPlaying ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
                    {isPlaying ? '暂停' : '播放'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onPointerDown={() => handleFrameHoldDown('reverse')}
                    onPointerUp={() => handleFrameHoldUp('reverse')}
                    onPointerLeave={() => handleFrameHoldUp('reverse')}
                    onPointerCancel={() => handleFrameHoldUp('reverse')}
                    title="点击回退一帧；长按 0.5 倍速反向播放，松开自动定位当前帧"
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onPointerDown={() => handleFrameHoldDown('forward')}
                    onPointerUp={() => handleFrameHoldUp('forward')}
                    onPointerLeave={() => handleFrameHoldUp('forward')}
                    onPointerCancel={() => handleFrameHoldUp('forward')}
                    title="点击步进一帧；长按 0.5 倍速正向播放，松开自动定位当前帧"
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                  <span className="ml-1 text-xs tabular-nums text-ams-text-muted">
                    第{' '}
                    {Math.min(timeToFrameIndex(currentTimeMs, fps), Math.max(durationToFrameCount(videoDurationMs, fps) - 1, 0))}{' '}
                    帧 / {durationToFrameCount(videoDurationMs, fps)} 帧 · {fmtMs(currentTimeMs)} / {fmtMs(videoDurationMs)}
                  </span>
                  <label className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-ams border border-ams-border px-2.5 py-1.5 text-xs text-ams-text-secondary transition-colors hover:bg-ams-surface-hover">
                    <Upload className="h-3.5 w-3.5" />
                    更换视频
                    <input type="file" accept="video/*" className="hidden" onChange={handleFile} />
                  </label>
                </div>
                <input
                  type="range"
                  min={0}
                  max={videoDurationMs}
                  step={1}
                  value={Math.min(currentTimeMs, videoDurationMs)}
                  onChange={(e) => seekTo(Number(e.target.value))}
                  className="w-full accent-ams-primary"
                />
              </div>
            )}

            {videoUrl && (
              <div className="mt-4 border-t border-ams-border pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-ams-text-primary">帧标记</h4>
                  <Button type="button" size="sm" variant="ghost" onClick={clearMarks}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    重置
                  </Button>
                </div>
                <p className="mb-2 text-xs text-ams-text-muted">
                  将视频暂停在关键帧，点击「标记」记录该帧时间；可用 ←/→ 逐帧微调。
                </p>
                {renderMarks()}
              </div>
            )}
          </div>
        </div>

        {/* ---------- 右列：结果 + 保存 + 历史 ---------- */}
        <div className="space-y-5">
          {/* 结果 */}
          <div className="ams-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-ams-text-primary">分析结果</h3>
            {renderResult()}

            {videoUrl && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ams-border pt-4">
                <Button type="button" onClick={saveRecord} disabled={saving}>
                  <Save className="mr-1 h-4 w-4" />
                  {saving ? '保存中…' : '保存结果'}
                </Button>
                {savedMsg && (
                  <span className="inline-flex items-center gap-1 text-sm text-ams-success">
                    <CheckCircle2 className="h-4 w-4" />
                    {savedMsg}
                  </span>
                )}
                {errorMsg && (
                  <span className="inline-flex items-center gap-1 text-sm text-ams-danger">
                    <AlertCircle className="h-4 w-4" />
                    {errorMsg}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 历史与趋势 */}
          <div className="ams-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-ams-text-primary">
              历史记录{athleteId ? `（${athletes.find((a) => a.id === athleteId)?.name ?? ''}）` : ''}
            </h3>
            {!athleteId ? (
              <p className="text-sm text-ams-text-muted">请先选择运动员以查看其跳跃测试历史。</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-ams-text-muted">该运动员暂无跳跃分析记录。</p>
            ) : (
              <>
                {trendData.length >= 2 && (
                  <div className="mb-4 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fill: '#8B98A9', fontSize: 11 }} axisLine={{ stroke: '#1E3A5F' }} tickLine={{ stroke: '#1E3A5F' }} />
                        <YAxis tick={{ fill: '#8B98A9', fontSize: 11 }} axisLine={{ stroke: '#1E3A5F' }} tickLine={{ stroke: '#1E3A5F' }} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} cm`, '跳跃高度']} />
                        <Line type="monotone" dataKey="height" name="跳跃高度" stroke="#00E5A0" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {history.map((h) => {
                    const hMeta = getJumpTestTypeMeta(h.testType);
                    const height = historyHeight(h);
                    return (
                      <div
                        key={h.id}
                        className="flex flex-wrap items-center gap-2 rounded-ams border border-ams-border bg-ams-background/40 px-3 py-2.5"
                      >
                        <span className="rounded-full bg-ams-primary/10 px-2 py-0.5 text-xs font-medium text-ams-primary">
                          {hMeta?.short ?? h.testType}
                        </span>
                        <span className="text-sm tabular-nums text-ams-text-secondary">{h.testDate}</span>
                        <span className="text-sm font-semibold tabular-nums text-ams-text-primary">
                          {height != null ? `${height.toFixed(1)} cm` : '—'}
                        </span>
                        {h.rsi != null && (
                          <span className="text-xs tabular-nums text-ams-text-secondary">RSI {h.rsi.toFixed(2)}</span>
                        )}
                        {h.dropHeightCm != null && (
                          <span className="text-xs tabular-nums text-ams-text-secondary">下落 {h.dropHeightCm}cm</span>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteRecord(h.id)}
                          className="ml-auto rounded-ams p-1 text-ams-text-muted transition-colors hover:bg-ams-surface-hover hover:text-ams-danger"
                          title="删除记录"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 结果卡片
// ============================================================

function ResultCard({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-ams border px-3 py-2.5',
        highlight ? 'border-ams-primary/40 bg-ams-primary/10' : 'border-ams-border bg-ams-background/40'
      )}
    >
      <p className="text-xs text-ams-text-muted">{label}</p>
      <p className={cn('mt-0.5 text-lg font-semibold tabular-nums', highlight ? 'text-ams-primary' : 'text-ams-text-primary')}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-ams-text-muted">{unit}</span>}
      </p>
    </div>
  );
}
