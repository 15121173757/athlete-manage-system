# 体能测试管理模块迁移报告

- 日期：2026-08-20
- 变更类型：结构化架构调整（新增独立模块 + 功能迁移）
- 状态：已完成并通过全部验证

## 一、背景与目标

原「体能训练与测试」模块（`/training`）内以 Tab 形式承载「测试计划」功能。本次调整将其拆分为独立功能模块「体能测试管理」（`/fitness-test`），实现模块边界清晰化，同时保证：

1. 测试计划相关功能（数据模型、业务逻辑、前端界面、API 接口、权限配置）完整迁移；
2. 迁移过程中数据不丢失、格式兼容；
3. 原模块中的测试计划代码及界面元素被移除；
4. 系统菜单与导航结构反映模块调整；
5. 迁移前后数据一致、权限配置正确、新旧模块数据交互正常。

## 二、关键设计决策

| 决策点 | 方案 |
| --- | --- |
| 新模块路由 | `/fitness-test`（首页）+ `/fitness-test/plans`（列表）+ `/fitness-test/plans/new`（新建）+ `/fitness-test/plans/[id]`（详情） |
| 后端 API | 保留 `/api/fitness/plans*` 原样复用（其已是 fitness 领域模块化 API，无需搬迁） |
| 数据库 | **零 schema 变更**：直接复用 `FitnessTestPlan` / `FitnessTestPlanItem` / `FitnessTestPlanParticipant` 三张既有表，物理数据零迁移 |
| 原模块处理 | 更名为「体能训练管理」（`/training`），移除「测试计划」Tab，仅保留「训练计划」「出勤管理」 |
| 侧边栏 | 核心业务分组拆分为「体能训练管理」+「体能测试管理」两项；排序存储键 `v2` → `v3` 防旧排序污染 |

## 三、迁移前后对照

### 3.1 路由与界面

| 维度 | 迁移前 | 迁移后 |
| --- | --- | --- |
| 模块标题 | 体能训练与测试管理 | 体能训练管理（`/training`） / 体能测试管理（`/fitness-test`） |
| 测试计划列表 | `/training/test-plans` | `/fitness-test/plans` |
| 新建测试计划 | `/training/test-plans/new` | `/fitness-test/plans/new` |
| 计划详情 | `/training/test-plans/[id]` | `/fitness-test/plans/[id]` |
| 前端组件 | `training/components/TestPlansView.tsx`（Tab 内嵌） | 独立路由页面 3 个（列表/新建/详情） |
| 模块首页 | 无 | 新增：统计概览（总数/草稿/待执行/已执行）+ 快捷入口 + 近期测试计划 |

### 3.2 数据模型（零变更）

- `FitnessTestPlan`（`fitness_test_plans`，主表）
- `FitnessTestPlanItem`（`fitness_test_plan_items`，级联删除，`@@index([planId, sortOrder])`）
- `FitnessTestPlanParticipant`（`fitness_test_plan_participants`，级联删除 + `@@unique([planId, athleteId])`）

### 3.3 后端逻辑（原样复用）

- `app/api/fitness/plans/route.ts`：GET（FITNESS_READ）/ POST（FITNESS_WRITE）
- `app/api/fitness/plans/[id]/route.ts`：GET / PUT / DELETE
- `app/api/fitness/plans/[id]/publish/route.ts`：发布
- `app/api/fitness/plans/[id]/equipment/route.ts`：器材汇总
- `lib/modules/fitness/FitnessService.ts`：全部服务方法
- `lib/modules/fitness/fitnessPlanStatus.ts`：状态机（DRAFT → SCHEDULED/COMPLETED，北京时间精确到分钟）
- `instrumentation.ts`：定时刷新计划状态

### 3.4 审计日志

`CREATE_FITNESS_PLAN` / `UPDATE_FITNESS_PLAN` / `PUBLISH_FITNESS_PLAN` / `FITNESS_PLAN_STATUS_CHANGE` 事件随 API 复用保持不变。

## 四、数据对比报告

### 4.1 迁移前后数据基准（数据库直查，迁移前后均一致）

| 表 | 记录数 |
| --- | --- |
| fitness_test_plans | 6 |
| fitness_test_plan_items | 17 |
| fitness_test_plan_participants | 28 |
| fitness_tests（测试库，关联来源） | 62 |

### 4.2 完整性校验

| 校验项 | 结果 |
| --- | --- |
| 计划状态分布 | 6/6 全部 COMPLETED |
| 孤儿明细（items.planId 无对应主表） | 0 |
| 孤儿参与（participants.planId 无对应主表） | 0 |
| 迁移前后数据量变化 | 无（零 schema 变更，物理数据未动） |

### 4.3 三层一致性（DB ↔ API ↔ DOM）

- DB 直查总数 = `GET /api/fitness/plans?pageSize=1` 返回 total
- 首页统计卡片（6/0/0/6）与 API total 一致
- 列表页渲染 6 条记录、分页与筛选正常；详情页展示测试项目/参与人员/器材汇总
- 悬停/点击链路：列表 → 详情、新建 → 提交 → 详情跳转，均正常

### 4.4 已知数据瑕疵（非本次引入）

`fitness_test_plans` 中 id 2/3/5 的名称与地点为字面 "?"（历史 API 写入编码丢失），与本次迁移无关；id 4/6 中文字符串显示正常。

## 五、功能验证清单

### 5.1 模块功能（E2E 实测通过）

- [x] 侧边栏同时展示「体能训练管理」「体能测试管理」两个菜单项，点击跳转正确
- [x] 新模块首页渲染 4 个统计卡片，数值与 API total 一致
- [x] 快捷入口跳转（计划列表 / 新建计划 / 测试库 `?tab=tests`）正常
- [x] 近期测试计划列表渲染 5 条，点击跳转详情成功
- [x] 计划列表页：分页、状态筛选、整行点击跳转
- [x] 新建页：四区块（基本信息 / 参与人员 / 测试项目选择 / 器材汇总），提交后跳转详情
- [x] 详情页：状态标签 / 信息网格 / 测试项目（器材就绪切换）/ 参与人员 / 器材汇总；草稿可编辑（PUT 全量替换）；发布、删除
- [x] 原「体能训练管理」仅剩「训练计划」「出勤管理」两个 Tab，功能不受影响

### 5.2 旧地址清理

- [x] `/training/test-plans` 返回 404（Next.js 默认），旧测试计划代码已删除：
  - `app/(dashboard)/training/test-plans/page.tsx`
  - `app/(dashboard)/training/test-plans/new/page.tsx`
  - `app/(dashboard)/training/test-plans/[id]/page.tsx`
  - `app/(dashboard)/training/components/TestPlansView.tsx`

### 5.3 构建与静态检查

- [x] `npm run lint` 通过（仅 admin/audit + admin/users 既有 useEffect 警告）
- [x] `npm run build` 通过，64/64 路由生成：
  - 新增：`/fitness-test`、`/fitness-test/plans`、`/fitness-test/plans/new`、`/fitness-test/plans/[id]`
  - 消失：`/training/test-plans*`（旧路由）
  - `/training` 包体积 3.75kB → 2.77kB
- [x] 全量单测 174/174 通过（`npx vitest run --no-file-parallelism` 串行，11 个测试文件）

### 5.4 权限验证

权限配置未做任何改动，`/api/fitness/plans*` 的 `requirePermission` 校验保持原样：

| 角色 | FITNESS_READ | FITNESS_WRITE | 说明 |
| --- | --- | --- | --- |
| COACH | ✅ | ✅ | 可查看/创建/编辑/发布/删除 |
| MEDICAL | ✅ | ❌ | 只读（列表/详情查询正常，写操作被拒绝） |
| ADMIN | ✅ | ✅ | 可查看/创建/编辑/发布/删除 |

- [x] 未带 token 访问 `/api/fitness/plans` 返回 400 鉴权拦截（路由正常，非迁移引入）
- [x] 前端菜单对无权限角色的可见性策略与迁移前一致（未改动 `RolePermissions` 矩阵）

### 5.5 边界与兼容性

- [x] 首页 `Promise.all` 并发拉取统计与近期计划，接口任一失败时静默降级（catch 兜底），不阻塞页面渲染
- [x] 空数据场景：列表空态、统计卡片 0 值展示
- [x] 草稿状态计划不可直接进入执行序列，发布后按执行时间自动判定 SCHEDULED/COMPLETED（原状态机不变）
- [x] 侧边栏排序 localStorage 升级到 `v3`，旧 `v2` 数据不污染新菜单项顺序

## 六、迁移过程中发现并修复的问题

**首页近期计划不渲染（E2E 发现）**：`page.tsx` 中 `Promise.all` 第 5 个元素原本直接放置 `fetch(...)` 返回的 Response，未先 `.then((r) => r.json())`，导致 `recent.success` 恒为 `undefined`、`setRecentPlans` 永不执行，列表始终为空态。已修复为显式 `.then((r) => r.json()).catch(() => ({ success: false, data: null }))`，复验通过（5 条计划渲染 + 点击跳转成功）。

## 七、结论

本次迁移采用「零 schema 变更 + 后端 API 原样复用 + 前端路由搬迁」策略，物理数据完全未动（6 计划 / 17 明细 / 28 参与 / 62 测试库），迁移前后数据一致；原模块测试计划界面与代码已彻底移除（旧地址 404）；菜单导航、权限控制、审计日志、状态机均保持正确；全量测试、lint、build、E2E 七步验证全部通过。
