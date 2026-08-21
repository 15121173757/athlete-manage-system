# PB 变化趋势数据抓取修复与质量保障说明

- 日期：2026-08-20
- 模块：PB 管理 → PB 变化趋势（`/pb?tab=trend`）
- 涉及文件：
  - 后端：[PBService.ts](file:///c:/Users/10168/Documents/trae_projects/Athlete%20Manage%20System/athlete-manage-system/lib/modules/pb/PBService.ts)（`buildPBTrendSeries` / `getPBTrendData` / `ensurePBTrendConsistency`）
  - 新增：[trendValidation.ts](file:///c:/Users/10168/Documents/trae_projects/Athlete%20Manage%20System/athlete-manage-system/lib/modules/pb/trendValidation.ts)、[trendLogger.ts](file:///c:/Users/10168/Documents/trae_projects/Athlete%20Manage%20System/athlete-manage-system/lib/modules/pb/trendLogger.ts)
  - 前端：[PBTrendView.tsx](file:///c:/Users/10168/Documents/trae_projects/Athlete%20Manage%20System/athlete-manage-system/app/(dashboard)/pb/components/PBTrendView.tsx)
  - 测试：[pb-trend.test.ts](file:///c:/Users/10168/Documents/trae_projects/Athlete%20Manage%20System/athlete-manage-system/tests/pb-trend.test.ts)、[trend-validation.test.ts](file:///c:/Users/10168/Documents/trae_projects/Athlete%20Manage%20System/athlete-manage-system/tests/trend-validation.test.ts)
- 状态：已完成。174 项测试全通过（`vitest run --no-file-parallelism`）、lint / build 通过、浏览器 E2E 通过。

---

## 一、问题原因分析

### 1.1 现象

1. 选择时间范围 5 月 20 日至 8 月 21 日时，趋势图只显示到 6 月 20 日，后半段"消失"；
2. 追踪「严婉如 × 杠铃前蹲」时，该时间段内数据抓取不完整。

### 1.2 数据核查结论（排除法）

对数据库逐条核查「严婉如（ID 283）× 杠铃前蹲（ID 18）」：

| 日期 | 负荷 | 说明 |
| --- | --- | --- |
| 2026-05-20 | 50 kg | 首次纪录 |
| 2026-06-20 | 80 kg | **打破 PB** |
| 2026-07-20 | 70 kg | 未突破（<80） |
| 2026-08-20 | 40 kg | 未突破（<80） |

- **数据无缺失**：4 条记录全部存在于 `training_record` 表；
- **日期参数传递正确**：API 确实收到 `startDate=2026-05-20`、`endDate=2026-08-21` 并按完整区间查询；
- **年份说明**：系统当前数据库仅有 **2026 年** 的训练记录，不存在 2023 年数据（按年份分布 `[[2026, 4]]`），用户描述中的"2023"应为笔误，本验证按实际数据 2026-05-20 ~ 08-21 执行；
- 其余用户（刘月/李娜/王强/赵敏）同一时间区间数据均存在。

### 1.3 根本原因

**`buildPBTrendSeries` 的累计最佳逻辑只输出"打破 PB"的日期点。** 7-20 的 70kg、8-20 的 40kg 均未超过 6-20 的 80kg，被判定为"无意义点"直接跳过 → 序列只剩 5-20、6-20 两个点 → 前端 X 轴随之只渲染到 6-20，造成"截断"假象。

该问题具有**普遍性**：任何运动员、任何项目，只要区间内存在未突破纪录的训练，图形都会"截断"到最后一次突破日期。

---

## 二、解决方案

### 2.1 数据抓取修复（核心）

`buildPBTrendSeries` 改为 **每次有效训练（可提取 >0 的负荷值）都输出一个数据点，值为该次训练的实际成绩**：

- 依据项目追踪类型取值（MAX_WEIGHT 取负荷、MAX_REPS 取次数、metric 类取成绩值），**不再叠加"累计最佳"**——训练负荷回落（如 80kg 后练 70kg）如实反映在曲线上；
- 区间之前（`rangeStart` 前）的记录直接排除（无累计依赖，仅按所选范围输出）；
- 同一天多次训练保留当日最佳实际值；
- `getPBTrendData` 按 `endDate` 截断查询；PB 表仍按"历史最佳"口径维护（`ensurePBTrendConsistency`），与趋势图的"实际值"口径相互独立、互不干扰。

前端 `mergeSeriesToChartData` 将所选时间范围起止日期并入 X 轴，保证折线完整覆盖用户所选区间。

### 2.2 数据验证机制（新增）

[trendValidation.ts](file:///c:/Users/10168/Documents/trae_projects/Athlete%20Manage%20System/athlete-manage-system/lib/modules/pb/trendValidation.ts)（纯函数，可单测）对每次趋势查询抓取的记录自动校验，输出结构化报告：

| 字段 | 含义 |
| --- | --- |
| `totalRecords` | 区间内参与统计的记录总数 |
| `validRecords` / `invalidRecords` | 可/不可提取有效负荷值（>0）的记录数 |
| `invalidRecordIds` | 无效记录 ID（如 MAX_WEIGHT 但 load 为空/0） |
| `skippedByRangeStart` | 区间前被排除（不输出）的记录数 |
| `sameDayMerged` | 同日多次训练被合并数 |
| `warnings` | 中文告警列表（`INVALID_METRIC_VALUE` / `SAME_DAY_MERGED` 等） |
| `isClean` | 数据完整性是否完全正常 |

### 2.3 数据抓取日志系统（新增）

[trendLogger.ts](file:///c:/Users/10168/Documents/trae_projects/Athlete%20Manage%20System/athlete-manage-system/lib/modules/pb/trendLogger.ts) 按天落盘到 `logs/pb-trend-YYYY-MM-DD.log`：

- 关键节点：查询开始/完成（含参数、记录数、序列数、点数、耗时）；
- 异常记录：无效记录、自动修复动作、一致性告警、错误；
- 完全容错：目录自动创建，任何写日志失败仅 console 警告，绝不影响业务。

### 2.4 数据异常处理与自动修复（新增）

`ensurePBTrendConsistency`（仅当查询覆盖完整历史、即无 endDate 时执行）比对「训练记录推算的累计最佳」与「PB 表存储值」：

| 场景 | 处理 |
| --- | --- |
| PB 表缺失但存在有效记录 | **自动补建** PB 并记日志 |
| 推算值 > PB 表值（PB 落后） | **自动升级** PB（对齐训练记录）并记日志 |
| 推算值 < PB 表值（如手动录入） | **不降级**，仅 INFO 告警（`PB_HIGHER_THAN_RECORDS`），保护人工数据 |

前端 [PBTrendView.tsx](file:///c:/Users/10168/Documents/trae_projects/Athlete%20Manage%20System/athlete-manage-system/app/(dashboard)/pb/components/PBTrendView.tsx) 在图表区顶部渲染「数据校验提示」横幅，展示全部告警；底部展示数据加载状态（范围内共 N 条训练记录、M 个数据点）。

---

## 三、测试与验证结果

### 3.1 单元测试（174/174 通过）

- `tests/pb-trend.test.ts`（8 项）：实际训练值输出（无累计最佳叠加）、严婉如负荷回落场景（7-20 显示 70）、rangeStart 区间前排除、同日多次取当日最佳、LOWER_BETTER 方向、多项目分组、过滤无效记录/未知项目、空输入；
- `tests/trend-validation.test.ts`（7 项，新增）：有效/无效记录识别、MAX_REPS 次数为 0、metric 回退 actualReps、rangeStart 统计、同日合并计数与告警、空输入。

> 注：DB 集成类测试（attendance/injury 等）依赖共享 dev.db，并行执行存在既有隔离问题（外键冲突/运动员不存在）；按项目文档约定以串行方式 `npx vitest run --no-file-parallelism` 全量运行，174 项全部通过。

### 3.2 集成验证（多用户 × 多项目 × 多时间跨度）

| 场景 | 结果 |
| --- | --- |
| 严婉如 × 杠铃前蹲 5-20~8-21 | 4 点（50/80/70/40），4 条记录，isClean=true ✓ |
| 严婉如 × 杠铃前蹲 全部历史 / 5-20~6-20 / 6-21~8-21 / 7-01~8-21 / 8-01~8-21 | 各范围点数与记录数完全匹配 ✓ |
| 刘月 × 深蹲 5-20~8-21 | 6 条记录 → 3 点，同日合并告警 ✓ |
| 李娜 × 卧推 5-20~8-21 | 3 条记录 → 2 点 ✓ |
| 王强 × 硬拉 5-20~8-21 | 1 条记录 → 1 点 ✓ |
| 赵敏 × 冲刺跑（MAX_TIME，metricValue 缺失回退 reps） | 1 条记录 → 1 点，isClean=true ✓ |

### 3.3 自动修复机制专项验证

| 场景 | 结果 |
| --- | --- |
| PB 表值被压低（30）→ 查询后自动升级为 80，告警 `PB_STALE_REPAIRED` | 通过（验证后已恢复原始 PB） |
| PB 表值被人为抬高（90）→ 不降级，仅 INFO 告警 `PB_HIGHER_THAN_RECORDS` | 通过（验证后已恢复原始 PB） |

### 3.4 浏览器 E2E（admin/admin123）

| 场景 | 验证点 | 结果 |
| --- | --- | --- |
| 严婉如 × 杠铃前蹲 5-20~8-21 | X 轴刻度 `05-20/06-20/07-20/08-20/08-21`，状态"4 条训练记录、4 个数据点"，无校验提示（数据干净） | 通过 |
| 刘月 × 深蹲 5-20~8-21 | 状态"6 条训练记录、3 个数据点"，校验提示"检测到 3 条同日多次训练记录，已合并为当日最佳值" | 通过 |

截图：`%Temp%\trae\screenshots\pb-trend-yanwanru.png`、`pb-trend-liuyue.png`。

### 3.5 日志系统验证

`logs/pb-trend-2026-08-20.log` 正确记录每次查询的开始/完成节点（参数、记录数、点数、耗时），格式完整、UTF-8 编码正常。

---

## 四、验收对照

| 要求 | 达成情况 |
| --- | --- |
| 任意时间范围完整显示区间内所有 PB 数据 | ✅ 每次有效训练均输出点，X 轴覆盖所选起止日期 |
| 所有用户的各类训练项目数据完整抓取 | ✅ 多用户 × 力量/时间/距离类项目验证通过 |
| 数据加载状态提示 | ✅ 加载中 / 空状态 / 加载完成（条数、点数） |
| 数据验证机制（自动校验） | ✅ `trendValidation` + 前端校验提示横幅 |
| 数据抓取日志系统 | ✅ `logs/pb-trend-*.log` 关键节点与异常落盘 |
| 数据异常告警与自动修复 | ✅ 无效记录告警、PB 缺失补建、PB 落后升级、手动录入保护（不降级） |
| 功能修复文档 | ✅ 本文档 |

---

## 五、趋势曲线数值口径修正（数据修正报告）

- 修正时间：2026-08-20（第二阶段）
- 反馈问题：严婉如 7 月 20 日杠铃前蹲实际训练 70kg，趋势曲线却显示 80kg。

### 5.1 错误原因分析

**存储层无错误（已排除）**：原始 SQL 直查 `training_records` 表确认——id=91 的记录 `2026-07-20`、`actualLoad=70`（INT 类型原样存储）、`actualReps=10`、无同日重复、无字段转换/丢失。4 条记录（50/80/70/40）全部完整。

**错误在趋势曲线生成算法的"口径"**：第一阶段修复后的 `buildPBTrendSeries` 输出的是**"截至当日的累计最佳"**（6-20 已达 80kg，7-20 虽只练 70kg 但点值保持 80），这是"PB 纪录演进"口径，并非"实际训练成绩"口径。当训练负荷回落（70/40 < 80）时，曲线不回落、保持 80，给用户造成"数据错误"的观感。

### 5.2 解决措施

将趋势曲线**口径改为"实际训练值"**（与"PB 表"的历史最佳口径分离）：

1. `buildPBTrendSeries`：每次有效训练输出该次训练的实际成绩（不再叠加累计最佳）；同日多次取当日最佳实际值；`rangeStart` 前记录直接排除；
2. 前端 `mergeSeriesToChartData` 保持按日期前向填充（边界日期 X 轴覆盖）；
3. 文案同步：页面副标题、加载提示、图表说明改为"各次训练成绩随时间的波动趋势"；
4. PB 表仍按"历史最佳"维护（`ensurePBTrendConsistency` 不受影响），两口径互不干扰；
5. 单元测试新增"严婉如场景：负荷回落后曲线如实显示实际值"用例，防止回归。

### 5.3 修正后验证结果

| 验证项 | 结果 |
| --- | --- |
| 单元测试（pb-trend + trend-validation） | 15/15 通过 |
| 服务层验证：严婉如 × 杠铃前蹲 5-20~8-21 | 趋势点 `[50, 80, 70, 40]`，7-20 = **70kg** ✓ |
| 全历史（无日期限制） | `[50, 80, 70, 40]`，与范围查询一致 ✓ |
| lint / build | 通过（63/63 路由） |
| 浏览器 E2E：悬停 07-20 数据点 tooltip | 「杠铃前蹲 : 70 kg」✓（截图 `%Temp%\trae\screenshots\pb-trend-verify-0720-70kg.png`） |

### 5.4 防止再次发生的校验机制

- `trendValidation` 自动校验每次查询的无效记录/同日合并/区间排除，异常即时告警（前端"数据校验提示"横幅 + 日志落盘）；
- 日志系统记录每次趋势查询的参数、记录数、点数与异常，便于追溯；
- PB 一致性自修复（`ensurePBTrendConsistency`）持续保证 PB 表与训练记录对齐（升级不降级、保护手动录入）；
- 新增"实际值口径"专项单测，防止任何回归到"累计最佳覆盖实际值"的实现。
