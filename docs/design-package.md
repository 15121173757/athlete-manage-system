# 《运动员管理系统 LLM 开发设计包》

> 由 ArchPilot 架构领航生成 | 生成日期：2026-08-04
> 项目代号：AMS (Athlete Manage System)

---

## 1. 项目定位

**面向运动队内部交付的运动员管理信息系统**，服务教练员与科研/医疗辅助人员，覆盖训练管理、体能测试、健康伤病跟踪三大核心业务闭环，集成 LLM 智能分析能力，部署于团队内网。

- **定位等级**：交付/内部工具（非练手、非商业化 MVP）
- **质量要求**：稳定少 bug 优先，边界处理完备
- **部署形态**：内网部署，数据不出内网

---

## 2. 需求理解与合理假设

### 用户明确说了什么
1. 项目定位为交付/内部工具，需稳定运行
2. 目标用户为教练员（主导）+ 科研/医疗辅助人员
3. V1 核心功能：训练管理（含 PB 历史最好纪录查询）+ 体能测试与分析 + 健康与伤病跟踪
4. LLM 场景：训练表现分析报告 + 伤病风险预警 + 自然语言查询助手
5. 数据输入：表单录入 + Excel/CSV 导入 + PDF/Word 导出 + Polar 心率带接口（仅预留）
6. 延后功能：赛事成绩管理、运动员个人端、多团队多租户、Polar 实时同步
7. 中文为主，专业术语保留英文
8. UI 风格：专业运动数据台（深色），深蓝+荧光橙+青绿配色
9. 技术栈：Next.js 14+ + TypeScript + Tailwind + shadcn/ui + Prisma + PostgreSQL
10. LLM：多家可切换（智谱 GLM / DeepSeek / Qwen），API Key 服务端 env

### 用户没说清楚什么
1. 运动员档案具体字段范围（基本信息到什么程度）
2. 训练计划的具体结构（按日/周/周期？）
3. 体能测试的具体指标项（是固定项还是可配置）
4. 健康监测指标的采集频率与来源（人工录入还是设备导入）
5. RBAC 的具体角色权限矩阵细节

### 当前合理假设
1. 运动员档案包含：姓名、性别、出生日期、身高、体重、项目、位置、入队日期、照片（可选）
2. 训练计划按「周」为基本单位，每日可含多个训练项目，每个项目含动作/组数/次数/负荷/备注
3. 体能测试指标采用「可配置项目 + 固定常用项」混合模式，常用项如：1RM、纵跳、冲刺、VO2max、柔韧性
4. 健康监测指标 V1 以人工录入为主（心率、睡眠时长、RPE 主观疲劳度），Polar 数据仅预留接口
5. RBAC 角色：教练员（读写训练+体能，只读健康）、医研人员（只读训练+体能，读写健康）、管理员（全部读写+用户管理）

### 假设对架构的影响
1. 档案字段可配置 → 数据模型需预留 `metadata` JSON 字段
2. 训练计划按周 → 需「周期化」数据结构
3. 体能测试可配置 → 需「测试项目字典表」
4. 健康指标多源 → 需「数据来源标记」字段
5. RBAC 三角色 → 中间件层统一鉴权，不侵入业务模块

---

## 3. MVP 功能边界

### 第一版必须做（V1）
1. 用户认证与 RBAC（教练员/医研人员/管理员三角色）
2. 运动员档案管理（CRUD + 查询 + 照片上传）
3. 训练计划制定与分配（按周周期化）
4. 训练记录上报与查询
5. **每个练习的历史最好纪录（PB）自动追踪与查询**
6. 体能测试数据录入与趋势分析图表
7. 体能测试成绩对比与超标预警
8. 伤病记录与康复计划管理
9. 健康监测指标录入（心率/睡眠/RPE 等）
10. LLM 场景 A：训练表现智能分析报告
11. LLM 场景 B：伤病风险预警与建议
12. LLM 场景 C：自然语言查询助手
13. Excel/CSV 批量导入（训练记录、体能测试）
14. PDF/Word 导出（训练计划、康复计划）
15. 数据访问日志（敏感数据操作留痕）

### 第二版再做（V2+）
1. 赛事成绩管理（报名、成绩录入、赛季统计）
2. 运动员个人端（本人登录查看）
3. 多团队多租户（跨队统计、团队隔离）
4. Polar 心率带实时同步
5. 训练计划模板库
6. 数据可视化大屏
7. 消息通知（训练计划下达、预警推送）

### 暂时不做
1. 支付系统
2. 企业 SSO
3. 移动端 App
4. 公开 API 开放平台
5. 多语言切换

---

## 4. 用户流程

### 教练员典型流程
1. 登录系统 → 进入数据看板（待办：新分配的训练计划、待审核的训练记录）
2. 查看运动员列表 → 选择运动员 → 查看档案与近期训练概况
3. 制定本周训练计划 → 添加训练项目（动作/组数/次数/负荷）→ 分配给运动员
4. 查看运动员上报的训练记录 → 系统自动更新 PB 纪录
5. 进入体能测试模块 → 录入测试数据 → 查看趋势图表与对比分析
6. 触发 LLM「训练表现分析报告」→ 输入分析周期 → 获取 AI 报告 → 导出 PDF
7. 使用「自然语言查询」→ 输入"张三这个月深蹲进步多少" → 获取答案

### 医研人员典型流程
1. 登录系统 → 进入健康看板（待办：新增伤病记录、待更新康复计划）
2. 查看运动员健康列表 → 筛选有伤病标记的运动员
3. 录入伤病记录 → 制定康复计划 → 设置回归训练条件
4. 录入健康监测指标（心率/睡眠/RPE）
5. 触发 LLM「伤病风险预警」→ 输入运动员与时间范围 → 获取风险评估与建议
6. 导出康复计划为 Word 文档

---

## 5. 界面语言与 UI 设计规范

### 界面语言
- 中文为主
- 专业术语保留英文：HRV、1RM、VO2max、bpm、kg、km、RPE、PB（Personal Best）
- 日期格式：ISO YYYY-MM-DD
- 时间格式：24 小时制
- 单位：公制（kg/km/bpm/℃）

### UI 风格
专业运动数据台（深色专业）—— 类似体育实验室监测中心质感

### 主色调
| 用途 | 颜色 | 色值 |
|---|---|---|
| 背景主色 | 深蓝黑 | `#0A1929` |
| 卡片背景 | 深蓝灰 | `#132F4C` |
| 强调色 | 荧光橙 | `#FF6B35` |
| 状态-正常/成功 | 青绿 | `#00E5A0` |
| 状态-警告 | 琥珀 | `#FFB800` |
| 状态-危险/超标 | 珊瑚红 | `#FF4D6D` |
| 主文字 | 浅灰白 | `#E6EDF3` |
| 次文字 | 中灰 | `#8B98A9` |
| 边框 | 深灰蓝 | `#1E3A5F` |

### 页面结构
1. **顶栏**：Logo + 全局搜索（自然语言查询入口）+ 用户菜单 + 角色标识
2. **左侧导航**：数据看板 / 运动员 / 体能训练 / 体能测试 / PB记录 / 伤病与负荷监控 / 数据分析 / 系统管理
3. **主内容区**：数据表格 + 图表卡片 + 操作面板
4. **右侧抽屉**：详情查看、快速编辑、AI 报告展示
5. **状态层**：空状态 / 加载骨架 / 错误提示（统一中文错误文案）

---

## 6. 责任完整但不过度复杂的架构说明

### 已覆盖的应用责任
1. 页面/UI 层（AppShell + 各业务页面）
2. 用户输入层（表单、文件上传、查询输入）
3. 校验层（Zod schema 校验）
4. 业务流程编排层（Service 层）
5. Prompt 管理层（独立 PromptBuilder 模块）
6. 真实 LLM 调用层（AIClient 抽象 + Provider 适配）
7. 结果解析层（ResultParser）
8. 数据结构层（Prisma Schema + TypeScript Types）
9. 文件处理层（Excel/CSV 解析、PDF/Word 生成）
10. 结果展示层（DataTable + Charts + ReportPanel）
11. 导出层（ExportService）
12. 错误处理层（ErrorPresenter 统一中文错误）
13. 配置管理层（ConfigService 环境变量）
14. UI 语言/风格层（Tailwind 主题 + 术语字典）
15. 认证授权层（AuthMiddleware + RBAC）
16. 数据访问日志层（AuditLogger）
17. 后续扩展接口层（Polar 接口预留、多租户预留）

### 明确不引入的复杂设计
1. 微服务（保持模块化单体）
2. 消息队列
3. 复杂 DDD（保持 Service + Repository 简洁分层）
4. 多租户权限（V1 单团队）
5. 企业 SSO
6. 完整支付系统
7. 插件市场
8. 无用抽象基类（不为未来不确定的需求造抽象）
9. 实时推送（V1 不做 WebSocket）
10. 离线缓存（V1 不做 PWA）

### 架构原则
**模块化单体**：一个项目仓库，一个 Next.js 应用，内部模块边界清晰。模块通过 Service 层与 Repository 层协作，UI 不直接访问数据库，LLM 调用全部经 `/api/llm` 代理路由。

---

## 7. 推荐技术栈

### 主方案
| 层 | 选型 | 版本 |
|---|---|---|
| 框架 | Next.js (App Router) | 14+ |
| 语言 | TypeScript | 5+ |
| 样式 | Tailwind CSS | 3+ |
| 组件库 | shadcn/ui | latest |
| 图表 | Recharts | 2+ |
| 表单 | React Hook Form + Zod | latest |
| ORM | Prisma | 5+ |
| 数据库 | PostgreSQL | 15+ |
| 认证 | NextAuth.js (Auth.js) | 4+ |
| 密码哈希 | bcryptjs | latest |
| Excel 解析 | SheetJS (xlsx) | latest |
| CSV 解析 | papaparse | latest |
| PDF 生成 | @react-pdf/renderer | latest |
| Word 生成 | docx | latest |
| LLM SDK | 多 Provider：@zhipu/zhipuai / openai (兼容 DeepSeek) / @alicloud/dashscope | latest |
| 日期 | date-fns | 3+ |
| 状态管理 | Zustand | 4+ |
| 请求 | SWR | 2+ |

### 选择原因
1. 延续用户熟悉技术栈，学习成本低
2. Next.js 全栈能力，前后端同仓库，适合内网部署
3. Prisma + PostgreSQL 类型安全，迁移管理清晰
4. shadcn/ui 可定制性强，适配深色主题
5. Recharts 声明式图表，与 React 生态契合
6. NextAuth.js 内置 RBAC 支持，社区成熟
7. 多 LLM Provider 通过统一抽象层切换，符合「多家可切换」需求

### 备选方案
- 若内网无 Node.js 运行环境：考虑 Docker 容器化部署
- 若 Polar 实时同步需求提前：增加 WebSocket（socket.io）层

---

## 8. 模块职责设计

### Module: AuthModule（认证授权模块）

**Responsibility**
1. 用户登录/登出
2. 会话管理（JWT）
3. RBAC 角色权限校验（教练员/医研人员/管理员）
4. 密码哈希与验证

**Non-responsibility**
1. 不负责用户注册（管理员后台创建账号）
2. 不负责第三方 OAuth
3. 不负责多租户隔离

**Input**
1. 用户名 + 密码
2. 请求上下文（用于中间件鉴权）

**Output**
1. 会话 Token
2. 当前用户信息 + 角色

**Public interface**
1. `POST /api/auth/login`
2. `POST /api/auth/logout`
3. `GET /api/auth/session`
4. `requireRole(role: Role)` 中间件
5. `getCurrentUser()` 服务端工具函数

**Hidden internals**
1. bcrypt 哈希策略
2. JWT 签名密钥
3. 会话存储细节

**Dependencies**
1. Prisma（User 表）

**Extension points**
1. 未来可扩展 OAuth Provider
2. 未来可扩展多租户角色

**Run/test focus**
1. 登录成功/失败用例
2. 越权访问拦截
3. Token 过期处理

---

### Module: AthleteModule（运动员档案模块）

**Responsibility**
1. 运动员档案 CRUD
2. 运动员列表查询（分页、筛选、搜索）
3. 照片上传与存储
4. 档案字段可配置（metadata JSON）

**Non-responsibility**
1. 不负责训练数据
2. 不负责健康数据
3. 不负责权限校验（由 AuthModule 中间件统一处理）

**Input**
1. 档案表单数据
2. 照片文件
3. 查询条件

**Output**
1. 运动员对象
2. 分页列表

**Public interface**
1. `GET /api/athletes` 列表
2. `GET /api/athletes/:id` 详情
3. `POST /api/athletes` 创建
4. `PUT /api/athletes/:id` 更新
5. `DELETE /api/athletes/:id` 删除
6. `AthleteService` 类（供其他模块调用）

**Hidden internals**
1. 照片文件存储路径
2. metadata 字段结构

**Dependencies**
1. Prisma（Athlete 表）
2. 文件系统（照片存储）

**Extension points**
1. metadata 字段支持扩展自定义属性
2. 未来可接入运动员个人端

**Run/test focus**
1. CRUD 全流程
2. 筛选查询准确性
3. 照片上传与回显

---

### Module: TrainingModule（训练管理模块）

**Responsibility**
1. 训练计划制定（按周周期化）
2. 训练计划分配给运动员
3. 训练记录上报与查询
4. **PB（个人最好纪录）自动追踪与查询**
5. 训练项目字典管理

**Non-responsibility**
1. 不负责体能测试数据
2. 不负责健康数据
3. 不负责 LLM 分析（委托 AnalysisModule）

**Input**
1. 训练计划表单（周计划 + 每日项目）
2. 训练记录表单（实际完成数据）
3. 查询条件（运动员、日期范围、项目）

**Output**
1. 训练计划对象
2. 训练记录列表
3. PB 纪录对象

**Public interface**
1. `GET/POST/PUT/DELETE /api/training/plans`
2. `GET/POST /api/training/records`
3. `GET/POST /api/pb` 查询 / 手动录入 PB
4. `POST /api/pb/recompute` 重算全部 PB
5. `GET /api/pb/:athleteId` 查询某运动员所有 PB
6. `TrainingService` 类
7. `PBService` 类（独立模块 `lib/modules/pb/PBService.ts`）

**Hidden internals**
1. PB 自动更新算法（训练记录上报时触发）
2. 周期化数据结构

**Dependencies**
1. Prisma（TrainingPlan、TrainingRecord、PersonalBest、Exercise 表）
2. AthleteModule

**Extension points**
1. 未来支持训练计划模板库
2. 未来支持 Polar 设备数据自动上报

**Run/test focus**
1. 训练计划创建与分配
2. 训练记录上报后 PB 自动更新
3. PB 历史查询准确性

---

### Module: FitnessModule（体能测试模块）

**Responsibility**
1. 体能测试项目字典管理（可配置）
2. 测试数据录入
3. 历史趋势图表数据
4. 成绩对比分析
5. 超标预警

**Non-responsibility**
1. 不负责训练记录
2. 不负责 LLM 分析

**Input**
1. 测试项目定义
2. 测试数据表单
3. 查询条件

**Output**
1. 测试数据列表
2. 趋势数据（按时间序列）
3. 对比数据（多运动员或多时间点）
4. 预警列表

**Public interface**
1. `GET/POST/PUT/DELETE /api/fitness/tests` 测试项目字典
2. `GET/POST /api/fitness/records` 测试数据
3. `GET /api/fitness/trend/:athleteId/:testId` 趋势
4. `GET /api/fitness/compare` 对比
5. `FitnessService` 类

**Hidden internals**
1. 超标阈值算法
2. 趋势聚合算法

**Dependencies**
1. Prisma（FitnessTest、FitnessRecord 表）
2. AthleteModule

**Extension points**
1. 未来支持批量测试导入
2. 未来支持设备自动采集

**Run/test focus**
1. 测试数据录入与查询
2. 趋势图表数据正确性
3. 超标预警触发

---

### Module: HealthModule（伤病与负荷监控模块）

**Responsibility**
1. 负荷监控：基于 RPE 与训练时长统计训练量，自动计算急慢性负荷比（ACWR）
2. 伤病记录管理（仅医研人员可写）
3. 康复计划制定
4. 健康监测指标录入（心率/睡眠/RPE）
5. 健康数据查询

**Non-responsibility**
1. 不负责训练数据
2. 不负责 LLM 分析

**Input**
1. 训练负荷记录表单（运动员/日期/RPE/训练时长）
2. 伤病记录表单
3. 康复计划表单
4. 健康指标表单

**Output**
1. 运动员负荷概览（训练量、ACWR、风险分级）
2. 负荷记录列表
3. 单个运动员负荷详情（含 ACWR 风险评价文本）
4. 伤病记录列表
5. 康复计划对象
6. 健康指标时间序列

**Public interface**
1. `GET/POST /api/health/load` 负荷监控（概览 + 记录）
2. `GET /api/health/load/[athleteId]` 运动员负荷详情（含 EWMA ACWR 与风险评价）
3. `GET /api/health/load/risk-summary` 风险预警摘要（数据看板，ACWR Top5）
4. `GET/POST/PUT /api/health/injuries`
5. `GET/POST/PUT /api/health/recovery-plans`
6. `GET/POST /api/health/metrics`
7. `HealthService` 类、`LoadService` 类

**Hidden internals**
1. ACWR 计算：基于指数加权移动平均（EWMA）——急性负荷近 7 天（λ=0.25）、慢性负荷近 28 天（λ=2/29），分级：<0.8 绿（负荷不足）、0.8-1.3 黄（舒适区）、1.3-1.5 橙（风险升高）、>1.5 红（高风险）；详细算法、数据验证机制与技术说明见 `docs/acwr-methodology.md`
2. 伤病状态机（受伤→康复中→回归训练）
3. 指标数据来源标记（人工/设备）

**Dependencies**
1. Prisma（LoadRecord、Injury、RecoveryPlan、HealthMetric 表）
2. AthleteModule

**Extension points**
1. 未来接入 Polar 心率带数据
2. 未来接入其他健康监测设备

**Run/test focus**
1. 伤病记录全流程
2. 角色权限（教练只读，医研可写）
3. 健康指标录入与查询

---

### Module: AnalysisModule（LLM 分析模块）

**Responsibility**
1. 训练表现智能分析报告生成
2. 伤病风险预警与建议生成
3. 自然语言查询助手（NL→SQL/结构化查询）
4. Prompt 构建与管理
5. LLM 调用编排
6. 结果解析

**Non-responsibility**
1. 不负责 LLM Provider 具体调用（委托 AIClient）
2. 不负责数据持久化（调用各业务 Service 获取数据）
3. 不负责 UI 展示（返回结构化结果）

**Input**
1. 分析请求（运动员 ID、时间范围、分析类型）
2. 查询自然语言文本

**Output**
1. 结构化分析报告（Markdown + JSON）
2. 风险评估结果
3. 查询结果（结构化数据 + 自然语言解读）

**Public interface**
1. `POST /api/llm/analysis/training` 训练分析
2. `POST /api/llm/analysis/injury-risk` 伤病风险
3. `POST /api/llm/query` 自然语言查询
4. `AnalysisService` 类
5. `PromptBuilder` 类（独立子模块）

**Hidden internals**
1. Prompt 模板文件
2. 数据聚合算法（从各 Service 拉取并组织）
3. 结果解析与校验

**Dependencies**
1. AIClient（LLM 调用）
2. TrainingModule（获取训练数据）
3. FitnessModule（获取体能数据）
4. HealthModule（获取健康数据）
5. ResultParser（结果解析）

**Extension points**
1. 未来增加新分析场景（如赛事表现分析）
2. 未来支持多模型对比

**Run/test focus**
1. 真实 LLM 调用（禁止 mock）
2. Prompt 构建正确性
3. 结果解析健壮性（LLM 返回格式异常时降级）
4. API Key 缺失时的错误提示

---

### Module: AIClient（LLM 调用抽象层）

**Responsibility**
1. 多 Provider 统一抽象（智谱 GLM / DeepSeek / Qwen）
2. 通过 `/api/llm` 代理路由调用
3. API Key 服务端 env 管理
4. 调用参数（temperature/max_tokens）配置
5. 错误重试与降级

**Non-responsibility**
1. 不负责 Prompt 构建（由 AnalysisModule 的 PromptBuilder）
2. 不负责业务逻辑
3. 不暴露 API Key 到前端

**Input**
1. Provider 名称
2. Model 名称
3. Messages 数组
4. 调用参数

**Output**
1. LLM 响应文本
2. Token 用量
3. 调用元数据

**Public interface**
1. `POST /api/llm` 统一代理路由
2. `LLMClient` 类（服务端）
3. `getLLMConfig()` 读取环境变量

**Hidden internals**
1. 各 Provider SDK 适配细节
2. API Key 来源（env）
3. 重试策略

**Dependencies**
1. 各 Provider SDK
2. ConfigService

**Extension points**
1. 未来增加新 Provider
2. 未来支持流式响应

**Run/test focus**
1. 各 Provider 真实调用
2. API Key 缺失错误提示
3. Provider 切换

---

### Module: FileModule（文件处理模块）

**Responsibility**
1. Excel/CSV 批量导入解析（训练记录、体能测试）
2. PDF 导出（训练计划、分析报告）
3. Word 导出（康复计划）
4. 导入数据校验

**Non-responsibility**
1. 不负责业务逻辑
2. 不负责数据持久化（解析后交给业务 Service）

**Input**
1. 上传的文件
2. 导出请求参数

**Output**
1. 解析后的结构化数据数组
2. 生成的 PDF/Word 文件流

**Public interface**
1. `POST /api/import/training-records` Excel 导入训练记录
2. `POST /api/import/fitness-records` Excel 导入体能测试
3. `POST /api/export/training-plan/:id` PDF 导出训练计划
4. `POST /api/export/recovery-plan/:id` Word 导出康复计划
5. `POST /api/export/analysis-report` PDF 导出分析报告
6. `ImportService` 类
7. `ExportService` 类

**Hidden internals**
1. 文件解析库细节
2. PDF/Word 模板
3. 临时文件清理

**Dependencies**
1. SheetJS、papaparse
2. @react-pdf/renderer、docx
3. 各业务 Service（导入后写入）

**Extension points**
1. 未来支持更多文件格式
2. 未来支持批量导出

**Run/test focus**
1. Excel 导入数据正确性
2. PDF/Word 生成完整性
3. 大文件处理性能

---

### Module: AuditModule（审计日志模块）

**Responsibility**
1. 敏感数据操作日志（健康数据读写）
2. 登录日志
3. LLM 调用日志
4. 日志查询

**Non-responsibility**
1. 不负责业务数据
2. 不负责性能监控

**Input**
1. 操作上下文（用户、动作、目标、时间）

**Output**
1. 日志记录列表

**Public interface**
1. `logAction()` 工具函数（供其他模块调用）
2. `GET /api/audit/logs` 日志查询（仅管理员）

**Hidden internals**
1. 日志存储策略
2. 日志保留策略

**Dependencies**
1. Prisma（AuditLog 表）

**Extension points**
1. 未来接入日志分析
2. 未来接入告警

**Run/test focus**
1. 敏感操作留痕
2. 日志查询准确性

---

### Module: ErrorPresenter（错误处理模块）

**Responsibility**
1. 统一错误响应格式
2. 中文错误文案
3. 错误分类（业务错误、权限错误、系统错误、LLM 错误）

**Non-responsibility**
1. 不负责业务逻辑
2. 不负责日志记录

**Input**
1. 原始错误对象

**Output**
1. 统一错误响应 JSON
2. 中文错误提示

**Public interface**
1. `throw new BusinessError(code, message)` 业务错误
2. `throw new AuthError(message)` 权限错误
3. `errorMiddleware()` 全局错误中间件
4. `getErrorMessage(code)` 错误码→中文文案

**Hidden internals**
1. 错误码字典
2. 错误分类逻辑

**Dependencies**
1. 无（基础模块）

**Extension points**
1. 未来增加错误码
2. 未来接入告警

**Run/test focus**
1. 各类错误响应格式
2. 中文文案准确性

---

## 9. 数据结构设计

### Athlete（运动员）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Int (PK) | 主键 |
| name | String | 姓名 |
| gender | Enum | 性别（男/女） |
| birthDate | DateTime | 出生日期 |
| height | Float? | 身高 (cm) |
| weight | Float? | 体重 (kg) |
| sport | String | 项目 |
| position | String? | 位置 |
| joinDate | DateTime | 入队日期 |
| photoUrl | String? | 照片 URL |
| status | Enum | 状态（在队/休养/离队） |
| metadata | Json | 扩展字段 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### Exercise（训练项目字典）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Int (PK) | 主键 |
| name | String | 项目名称（如"深蹲"） |
| category | String | 分类（力量/速度/耐力/柔韧） |
| unit | String | 计量单位（kg/次/秒） |
| isPBTrackable | Boolean | 是否追踪 PB |

### TrainingPlan（训练计划）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Int (PK) | 主键 |
| athleteId | Int (FK) | 运动员 ID |
| coachId | Int (FK) | 教练员 ID |
| goal | String? | 训练目标 |
| items | TrainingPlanItem[] | 每日训练项目 |
| status | Enum | 状态（草稿/已发布/已完成） |

### TrainingPlanItem（训练计划项）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Int (PK) | 主键 |
| planId | Int (FK) | 计划 ID |
| dayOfWeek | Int | 星期几（1-7） |
| exerciseId | Int (FK) | 项目 ID |
| sets | Int | 组数 |
| reps | Int | 次数 |
| load | Float? | 负荷 (kg) |
| notes | String? | 备注 |

### TrainingRecord（训练记录）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Int (PK) | 主键 |
| athleteId | Int (FK) | 运动员 ID |
| planItemId | Int? (FK) | 关联计划项（可选） |
| exerciseId | Int (FK) | 项目 ID |
| actualSets | Int | 实际组数 |
| actualReps | Int | 实际次数 |
| actualLoad | Float? | 实际负荷 |
| trainingDate | DateTime | 训练日期 |
| rpe | Int? | 主观疲劳度 (1-10) |
| notes | String? | 备注 |
| recordedBy | Int (FK) | 录入人 ID |

### PersonalBest（个人最好纪录）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Int (PK) | 主键 |
| athleteId | Int (FK) | 运动员 ID |
| exerciseId | Int (FK) | 项目 ID |
| value | Float | 最好成绩值 |
| unit | String | 单位 |
| achievedDate | DateTime | 达成日期 |
| recordId | Int (FK) | 关联训练记录 |

### FitnessTest（体能测试项目字典）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Int (PK) | 主键 |
| name | String | 测试名称（如"1RM 深蹲"） |
| category | String | 分类 |
| unit | String | 单位 |
| direction | Enum | 方向（越大越好/越小越好） |
| warningThreshold | Float? | 预警阈值 |

### FitnessRecord（体能测试记录）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Int (PK) | 主键 |
| athleteId | Int (FK) | 运动员 ID |
| testId | Int (FK) | 测试项目 ID |
| value | Float | 测试值 |
| testDate | DateTime | 测试日期 |
| recordedBy | Int (FK) | 录入人 ID |

### Injury（伤病记录）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Int (PK) | 主键 |
| athleteId | Int (FK) | 运动员 ID |
| injuryType | String | 伤病类型 |
| description | String | 描述 |
| startDate | DateTime | 受伤日期 |
| endDate | DateTime? | 痊愈日期 |
| status | Enum | 状态（受伤/康复中/回归训练） |
| recordedBy | Int (FK) | 录入人 ID（医研人员） |

### RecoveryPlan（康复计划）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Int (PK) | 主键 |
| injuryId | Int (FK) | 关联伤病 ID |
| content | Text | 康复内容 |
| startDate | DateTime | 开始日期 |
| targetReturnDate | DateTime | 目标回归日期 |
| status | Enum | 状态（进行中/已完成） |

### HealthMetric（健康监测指标）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Int (PK) | 主键 |
| athleteId | Int (FK) | 运动员 ID |
| metricType | Enum | 类型（心率/睡眠/RPE/HRV） |
| value | Float | 值 |
| unit | String | 单位 |
| recordedAt | DateTime | 记录时间 |
| source | Enum | 来源（人工/Polar） |
| recordedBy | Int? (FK) | 录入人（人工时） |

### User（用户）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Int (PK) | 主键 |
| username | String | 用户名 |
| passwordHash | String | 密码哈希 |
| name | String | 姓名 |
| role | Enum | 角色（教练员/医研人员/管理员） |
| isActive | Boolean | 是否启用 |

### AuditLog（审计日志）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Int (PK) | 主键 |
| userId | Int (FK) | 操作用户 ID |
| action | String | 动作 |
| targetType | String | 目标类型 |
| targetId | String? | 目标 ID |
| detail | Json | 详情 |
| createdAt | DateTime | 时间 |

---

## 10. 接口与扩展点设计

### 第一版实现
1. `POST /api/auth/login` 登录
2. `POST /api/auth/logout` 登出
3. `GET /api/auth/session` 会话
4. `GET/POST/PUT/DELETE /api/athletes` 运动员 CRUD
5. `GET/POST/PUT/DELETE /api/training/plans` 训练计划 CRUD
6. `GET/POST /api/training/records` 训练记录
7. `GET/POST /api/pb` PB 查询 / 手动录入
8. `POST /api/pb/recompute` PB 重算
9. `GET/POST/PUT/DELETE /api/fitness/tests` 体能测试项目
10. `GET/POST /api/fitness/records` 体能测试数据
11. `GET /api/fitness/trend/:athleteId/:testId` 趋势
12. `GET/POST/PUT /api/health/injuries` 伤病记录
13. `GET/POST/PUT /api/health/recovery-plans` 康复计划
14. `GET/POST /api/health/load` 负荷监控（训练量 + ACWR）
15. `GET /api/health/load/:athleteId` 运动员负荷详情（EWMA ACWR + 风险评价）
16. `GET /api/health/load/risk-summary` 风险预警摘要（数据看板，ACWR Top5）
17. `GET/POST /api/health/metrics` 健康指标
18. `POST /api/llm/analysis/training` LLM 训练分析
19. `POST /api/llm/analysis/injury-risk` LLM 伤病风险
20. `POST /api/llm/query` LLM 自然语言查询
21. `POST /api/import/training-records` Excel 导入
22. `POST /api/import/fitness-records` Excel 导入
23. `POST /api/export/training-plan/:id` PDF 导出
24. `POST /api/export/recovery-plan/:id` Word 导出
25. `GET /api/audit/logs` 审计日志查询

### 后续预留
1. **Polar 心率带接口**：`POST /api/integrations/polar/data`（接收 Polar 数据）
   - 预留 `HealthMetric.source = 'Polar'` 字段
   - 预留 `PolarIntegrationService` 接口定义但不实现
2. **多团队多租户接口**：`GET /api/teams`、`PUT /api/users/:id/team`
   - 预留 `Athlete.teamId`、`User.teamId` 字段（V1 默认值）
3. **赛事成绩接口**：`POST /api/competitions`、`POST /api/competition-results`
4. **运动员个人端接口**：`GET /api/athlete-portal/:athleteId`

### 预留但不实现的原因
1. Polar 实时同步：需设备 SDK 与 WebSocket，V1 仅预留数据结构与接口签名
2. 多团队多租户：需数据隔离层，V1 单团队，预留字段避免后期迁移
3. 赛事成绩：与训练管理耦合度低，可独立后加
4. 运动员个人端：需独立权限模型，V1 聚焦管理端

---

## 11. 后续功能变更影响说明

### 如果未来增加「Polar 心率带实时同步」

需要改：
1. HealthModule（增加 PolarIntegrationService 子模块）
2. AIClient（不影响）
3. 前端健康看板（增加实时数据展示）

不应该改：
1. TrainingModule
2. FitnessModule
3. AuthModule

需要新增/扩展的数据结构：
1. `PolarSession` 表（设备会话）
2. `HealthMetric.source` 已预留 'Polar' 枚举值

当前预留接口：
1. `POST /api/integrations/polar/data`
2. `PolarIntegrationService` 接口定义

### 如果未来增加「多团队多租户」

需要改：
1. AuthModule（增加团队上下文）
2. 所有 Service 层（增加 teamId 过滤）
3. 数据库迁移（增加 teamId 字段）

不应该改：
1. AIClient
2. FileModule（导出逻辑不变）

需要新增/扩展的数据结构：
1. `Team` 表
2. `Athlete.teamId`、`User.teamId`（已预留）

### 如果未来增加「赛事成绩管理」

需要改：
1. 新增 CompetitionModule（独立模块）
2. 导航菜单

不应该改：
1. 现有所有模块（低耦合）

需要新增/扩展的数据结构：
1. `Competition` 表
2. `CompetitionResult` 表

---

## 12. 目录结构

```text
athlete-manage-system/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # 数据看板
│   │   ├── athletes/
│   │   │   ├── page.tsx                # 运动员列表
│   │   │   ├── [id]/page.tsx           # 运动员详情
│   │   │   └── new/page.tsx            # 新建运动员
│   │   ├── training/
│   │   │   ├── plans/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/page.tsx
│   │   │   │   └── new/page.tsx
│   │   │   ├── records/
│   │   │   │   └── page.tsx
│   │   │   └── pb/
│   │   │       └── page.tsx            # PB 纪录查询
│   │   ├── fitness/
│   │   │   ├── tests/page.tsx
│   │   │   ├── records/page.tsx
│   │   │   └── analysis/page.tsx       # 趋势与对比
│   │   ├── health/
│   │   │   ├── page.tsx                   # 伤病与负荷监控主页（负荷监控/伤病管理 Tab）
│   │   │   ├── components/
│   │   │   │   ├── LoadMonitorView.tsx    # 负荷监控（ACWR 概览 + 记录）
│   │   │   │   ├── InjuriesView.tsx       # 伤病管理
│   │   │   │   ├── LoadBarChart.tsx       # 28 天训练量柱状图
│   │   │   │   └── riskStyles.ts          # ACWR 风险分级颜色映射
│   │   │   └── load/[athleteId]/page.tsx  # 运动员负荷详情（ACWR 风险评价）
│   │   ├── analysis/
│   │   │   ├── training/page.tsx       # LLM 训练分析
│   │   │   ├── injury-risk/page.tsx    # LLM 伤病风险
│   │   │   └── query/page.tsx          # 自然语言查询
│   │   └── admin/
│   │       ├── users/page.tsx
│   │       └── audit/page.tsx
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   └── session/route.ts
│       ├── athletes/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── training/
│       │   ├── plans/route.ts
│       │   ├── records/route.ts
│       │   └── pb/
│       │       └── [athleteId]/route.ts
│       ├── fitness/
│       │   ├── tests/route.ts
│       │   ├── records/route.ts
│       │   └── trend/[athleteId]/[testId]/route.ts
│       ├── health/
│       │   ├── load/route.ts              # 负荷概览 + 记录
│       │   ├── load/[athleteId]/route.ts  # 运动员负荷详情
│       │   ├── injuries/route.ts
│       │   ├── recovery-plans/route.ts
│       │   └── metrics/route.ts
│       ├── llm/
│       │   ├── route.ts                # 统一代理
│       │   ├── analysis/
│       │   │   ├── training/route.ts
│       │   │   └── injury-risk/route.ts
│       │   └── query/route.ts
│       ├── import/
│       │   ├── training-records/route.ts
│       │   └── fitness-records/route.ts
│       ├── export/
│       │   ├── training-plan/[id]/route.ts
│       │   ├── recovery-plan/[id]/route.ts
│       │   └── analysis-report/route.ts
│       ├── integrations/
│       │   └── polar/
│       │       └── data/route.ts       # 预留
│       └── audit/
│           └── logs/route.ts
├── components/
│   ├── ui/                             # shadcn/ui 组件
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   └── TopBar.tsx
│   ├── athletes/
│   ├── training/
│   ├── fitness/
│   ├── health/
│   ├── analysis/
│   └── common/
│       ├── DataTable.tsx
│       ├── ChartCard.tsx
│       ├── EmptyState.tsx
│       ├── LoadingSkeleton.tsx
│       └── ErrorBoundary.tsx
├── lib/
│   ├── auth/
│   │   ├── AuthMiddleware.ts
│   │   ├── rbac.ts
│   │   └── session.ts
│   ├── modules/
│   │   ├── athlete/
│   │   │   └── AthleteService.ts
│   │   ├── training/
│   │   │   ├── TrainingService.ts
│   │   │   └── PBService.ts
│   │   ├── fitness/
│   │   │   └── FitnessService.ts
│   │   ├── health/
│   │   │   ├── HealthService.ts
│   │   │   └── LoadService.ts
│   │   ├── analysis/
│   │   │   ├── AnalysisService.ts
│   │   │   ├── PromptBuilder.ts
│   │   │   └── ResultParser.ts
│   │   ├── file/
│   │   │   ├── ImportService.ts
│   │   │   └── ExportService.ts
│   │   └── audit/
│   │       └── AuditService.ts
│   ├── llm/
│   │   ├── LLMClient.ts
│   │   ├── providers/
│   │   │   ├── zhipu.ts
│   │   │   ├── deepseek.ts
│   │   │   └── qwen.ts
│   │   └── config.ts
│   ├── errors/
│   │   ├── ErrorPresenter.ts
│   │   └── errorCodes.ts
│   ├── db/
│   │   └── prisma.ts
│   └── utils/
│       ├── date.ts                     # ISO 日期处理
│       ├── unit.ts                     # 公制单位
│       └── validation.ts               # Zod schemas
├── prompts/
│   ├── training-analysis.ts
│   ├── injury-risk.ts
│   └── natural-query.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── types/
│   └── index.ts
├── public/
│   └── uploads/                        # 运动员照片
├── docs/
│   └── design-package.md               # 本文档
├── .env.example
├── .env.local
├── next.config.js
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## 13. 分阶段开发顺序

### Phase 0: 项目初始化与基础设施

**目标**：搭建可运行的空项目骨架，配置技术栈、数据库、主题

**修改文件**：
1. `package.json` 依赖配置
2. `next.config.js`
3. `tailwind.config.ts`（深色主题 + 品牌色）
4. `prisma/schema.prisma`（完整 Schema）
5. `.env.example`（环境变量模板）
6. `lib/db/prisma.ts`
7. `app/layout.tsx`（全局主题）
8. `components/layout/AppShell.tsx`、`Sidebar.tsx`、`TopBar.tsx`
9. `app/(dashboard)/page.tsx`（空数据看板）

**不要做**：
1. 不实现任何业务功能
2. 不接入 LLM
3. 不做认证

**验收标准**：
1. `npm run dev` 启动成功
2. `npm run build` 与 `npm run lint` 通过
3. 深色主题界面可见，左侧导航与顶栏渲染正常
4. Prisma 可连接数据库并执行迁移

**试运行**：
```bash
npm run build
npm run lint
npm run dev
```

---

### Phase 1: 认证授权与 RBAC

**目标**：实现登录登出、JWT 会话、三角色 RBAC 中间件

**修改文件**：
1. `lib/auth/session.ts`
2. `lib/auth/AuthMiddleware.ts`
3. `lib/auth/rbac.ts`
4. `app/api/auth/login/route.ts`
5. `app/api/auth/logout/route.ts`
6. `app/api/auth/session/route.ts`
7. `app/(auth)/login/page.tsx`
8. `prisma/schema.prisma`（User 表 + 种子数据）

**不要做**：
1. 不实现用户管理后台
2. 不实现 OAuth

**验收标准**：
1. 三角色账号可登录（种子数据：教练员/医研人员/管理员各 1 个）
2. 未登录访问 dashboard 跳转登录页
3. 越权访问被拦截并返回中文错误
4. `npm run build` 与 `npm run lint` 通过

**试运行**：
```bash
npm run build
npm run lint
npm run dev
```

---

### Phase 2: 运动员档案管理

**目标**：运动员档案 CRUD + 列表查询 + 照片上传

**修改文件**：
1. `lib/modules/athlete/AthleteService.ts`
2. `app/api/athletes/route.ts`
3. `app/api/athletes/[id]/route.ts`
4. `app/(dashboard)/athletes/page.tsx`
5. `app/(dashboard)/athletes/[id]/page.tsx`
6. `app/(dashboard)/athletes/new/page.tsx`
7. `components/athletes/*`
8. `lib/utils/validation.ts`（运动员 schema）

**不要做**：
1. 不实现训练/体能/健康模块
2. 不接入 LLM

**验收标准**：
1. 运动员 CRUD 全流程可用
2. 列表分页、搜索、筛选可用
3. 照片上传与回显
4. 仅管理员可删除，教练员可读写，医研人员只读
5. `npm run build` 与 `npm run lint` 通过

**试运行**：
```bash
npm run build
npm run lint
npm run dev
```

---

### Phase 3: 训练管理与 PB 追踪

**目标**：训练计划制定分配 + 训练记录上报 + PB 自动追踪查询

**修改文件**：
1. `lib/modules/training/TrainingService.ts`
2. `lib/modules/pb/PBService.ts`（独立 PB 模块）
3. `app/api/training/plans/route.ts`
4. `app/api/training/records/route.ts`
5. `app/api/pb/route.ts`、`app/api/pb/recompute/route.ts`
6. `app/(dashboard)/pb/page.tsx`（独立 PB 页面，侧边栏入口"PB记录"）
7. `app/(dashboard)/training/**`
8. `components/training/*`
9. `prisma/schema.prisma`（Exercise、TrainingPlan、TrainingPlanItem、TrainingRecord、PersonalBest 表）

**不要做**：
1. 不实现 LLM 分析
2. 不实现 Excel 导入

**验收标准**：
1. 训练计划可创建、分配、查看
2. 训练记录上报后 PB 自动更新
3. PB 查询页可查每个运动员每个练习的历史最好
4. 训练项目字典可管理
5. `npm run build` 与 `npm run lint` 通过

**试运行**：
```bash
npm run build
npm run lint
npm run dev
```

---

### Phase 4: 体能测试与伤病/负荷监控

**目标**：体能测试录入与图表分析 + 健康伤病记录与康复计划

**修改文件**：
1. `lib/modules/fitness/FitnessService.ts`
2. `lib/modules/health/HealthService.ts`
3. `app/api/fitness/**`
4. `app/api/health/**`
5. `app/(dashboard)/fitness/**`
6. `app/(dashboard)/health/**`
7. `components/fitness/*`（含 Recharts 图表）
8. `components/health/*`
9. `prisma/schema.prisma`（FitnessTest、FitnessRecord、Injury、RecoveryPlan、HealthMetric 表）

**不要做**：
1. 不实现 LLM 分析
2. 不实现 Polar 接口

**验收标准**：
1. 体能测试数据录入与查询
2. 趋势图表（Recharts）正确渲染
3. 超标预警触发
4. 伤病记录全流程（医研人员可写，教练只读）
5. 健康指标录入
6. `npm run build` 与 `npm run lint` 通过

**试运行**：
```bash
npm run build
npm run lint
npm run dev
```

---

### Phase 5: LLM 基础设施与训练分析报告

**目标**：搭建多 Provider LLM 抽象层，实现第一个 LLM 场景——训练表现智能分析报告

**修改文件**：
1. `lib/llm/LLMClient.ts`
2. `lib/llm/providers/zhipu.ts`
3. `lib/llm/providers/deepseek.ts`
4. `lib/llm/providers/qwen.ts`
5. `lib/llm/config.ts`
6. `app/api/llm/route.ts`（统一代理）
7. `app/api/llm/analysis/training/route.ts`
8. `lib/modules/analysis/AnalysisService.ts`
9. `lib/modules/analysis/PromptBuilder.ts`
10. `lib/modules/analysis/ResultParser.ts`
11. `prompts/training-analysis.ts`
12. `app/(dashboard)/analysis/training/page.tsx`
13. `components/analysis/*`
14. `.env.example`（LLM 配置变量）

**不要做**：
1. 不实现伤病风险与查询助手
2. 不实现导出
3. 不允许 mock 结果

**验收标准**：
1. 真实 LLM 调用成功（智谱 GLM / DeepSeek / Qwen 至少一家）
2. API Key 缺失时返回清晰中文错误
3. Provider 可通过环境变量切换
4. 训练分析报告生成并展示
5. Prompt 不写在页面组件里
6. API Key 不暴露前端
7. `npm run build` 与 `npm run lint` 通过

**试运行**：
```bash
npm run build
npm run lint
npm run dev
```

---

### Phase 6: 伤病风险预警与查询助手

**目标**：实现第二个与第三个 LLM 场景

**修改文件**：
1. `app/api/llm/analysis/injury-risk/route.ts`
2. `app/api/llm/query/route.ts`
3. `prompts/injury-risk.ts`
4. `prompts/natural-query.ts`
5. `app/(dashboard)/analysis/injury-risk/page.tsx`
6. `app/(dashboard)/analysis/query/page.tsx`
7. `lib/modules/analysis/AnalysisService.ts`（扩展）
8. `lib/modules/analysis/PromptBuilder.ts`（扩展）

**不要做**：
1. 不允许 mock 结果

**验收标准**：
1. 伤病风险预警生成
2. 自然语言查询可返回结构化结果 + 解读
3. LLM 调用日志写入审计表
4. `npm run build` 与 `npm run lint` 通过

**试运行**：
```bash
npm run build
npm run lint
npm run dev
```

---

### Phase 7: 文件导入导出

**目标**：Excel/CSV 批量导入 + PDF/Word 导出

**修改文件**：
1. `lib/modules/file/ImportService.ts`
2. `lib/modules/file/ExportService.ts`
3. `app/api/import/training-records/route.ts`
4. `app/api/import/fitness-records/route.ts`
5. `app/api/export/training-plan/[id]/route.ts`
6. `app/api/export/recovery-plan/[id]/route.ts`
7. `app/api/export/analysis-report/route.ts`
8. 前端导入导出按钮与交互组件

**不要做**：
1. 不实现 Polar 接口

**验收标准**：
1. Excel 模板下载
2. Excel 导入数据正确入库
3. PDF 训练计划导出
4. Word 康复计划导出
5. 导入数据校验与错误反馈
6. `npm run build` 与 `npm run lint` 通过

**试运行**：
```bash
npm run build
npm run lint
npm run dev
```

---

### Phase 8: 审计日志与系统管理

**目标**：审计日志查询 + 用户管理后台 + Polar 接口预留

**修改文件**：
1. `lib/modules/audit/AuditService.ts`
2. `app/api/audit/logs/route.ts`
3. `app/(dashboard)/admin/audit/page.tsx`
4. `app/(dashboard)/admin/users/page.tsx`
5. `app/api/integrations/polar/data/route.ts`（预留空实现 + 注释）
6. 在所有敏感操作处接入 `AuditService.logAction()`

**不要做**：
1. 不实现 Polar 真实集成

**验收标准**：
1. 健康数据读写有审计日志
2. LLM 调用有审计日志
3. 管理员可查询审计日志
4. 管理员可管理用户
5. Polar 接口路由存在但返回"功能未实现"提示
6. `npm run build` 与 `npm run lint` 通过

**试运行**：
```bash
npm run build
npm run lint
npm run dev
```

---

## 14. 给 LLM 编程工具的提示词

### 主提示词（Master Prompt）

```
你正在开发一个「运动员管理系统」（AMS），基于 Next.js 14+ App Router + TypeScript + Tailwind CSS + shadcn/ui + Prisma + PostgreSQL。

项目背景：面向运动队内部交付的管理系统，服务教练员与科研/医疗人员，覆盖训练管理、体能测试、健康伤病跟踪三大核心业务，集成 LLM 智能分析。

技术栈：Next.js 14+ App Router, TypeScript 5+, Tailwind CSS 3+, shadcn/ui, Prisma 5+, PostgreSQL 15+, Recharts 2+, React Hook Form + Zod, NextAuth.js, Zustand, SWR。

UI 语言规则：中文为主，专业术语保留英文（HRV/1RM/VO2max/bpm/kg/km/RPE/PB）。日期 ISO YYYY-MM-DD，时间 24 小时制，单位公制。

UI 风格规则：专业运动数据台深色风。背景 #0A1929，卡片 #132F4C，强调色 #FF6B35，状态色 #00E5A0/#FFB800/#FF4D6D，文字 #E6EDF3/#8B98A9，边框 #1E3A5F。

架构规则：使用责任完整但不过度复杂的架构。模块高内聚低耦合。禁止在 UI 组件中拼接 Prompt、直接调用 LLM Provider、混合输入与导出逻辑。

模块契约规则：每个核心模块必须有明确的 responsibility、non-responsibility、input、output、public interface、hidden internals、dependencies、extension points。

真实 LLM 集成规则：必须真实 LLM 调用，禁止 mock、禁止硬编码假结果、禁止假 API 路由。API Key 仅服务端 env，前端通过 /api/llm 代理调用。API Key 缺失时返回清晰中文错误。允许空/加载/错误状态，禁止假分析结果。

注释风格：学习型详细注释，说明 why、设计权衡、扩展点。
```

### 阶段提示词（Stage Prompt）模板

每个阶段使用以下模板：

```
当前阶段目标：[仅本阶段目标]

项目背景：运动员管理系统（AMS），Next.js 14+ 全栈，内网部署。

技术栈：[完整技术栈]

AI 编程工具：Trae

UI 语言规则：中文为主，专业术语英文保留。

UI 风格规则：深色专业运动数据台，深蓝+荧光橙+青绿配色。

架构规则：责任完整但不过度复杂，模块高内聚低耦合，禁止 UI 组件拼接 Prompt、直接调用 LLM、混合输入与导出。

模块契约规则：核心模块须有明确 responsibility/non-responsibility/input/output/public interface/hidden internals/dependencies/extension points。

真实 LLM 集成规则：禁止 mock，禁止硬编码假结果，API Key 仅服务端 env，缺失时返回中文错误。

需要完成：
1. [任务]

需要创建或修改的文件：
1. [文件]

禁止：
1. 不实现未确认功能
2. 不在本阶段添加登录/支付/后台/数据库/权限（除非本阶段明确要求）
3. 不在 UI 组件写业务逻辑
4. 不在页面组件拼接 Prompt
5. 不在前端暴露 API Key
6. 不引入不必要依赖
7. 不创建 mock 结果
8. 不默认英文 UI
9. 不生成无样式裸界面
10. 本阶段 run check 失败则不进入下一阶段

验收标准：
1. [标准]

Run check：
npm run build
npm run lint
npm run dev
```

### 最终自检提示词

```
完成所有阶段后，执行架构与代码自检：

1. 是否高内聚？（每个模块单一职责）
2. 是否低耦合？（模块通过 Service/Repository 交互，不直接访问对方内部）
3. 是否每个模块都有明确输入/输出？
4. 是否存在一个文件做太多事？
5. 是否把 Prompt 拼接写进页面？（应禁止）
6. 是否把 API Key 暴露到前端？（应禁止）
7. 是否引入无用依赖？
8. 是否有 Mock 假结果？（应禁止）
9. 是否保留合理扩展点？（Polar 接口、多租户字段）
10. 是否没有过度设计？（无微服务/消息队列/复杂 DDD）
11. 是否每阶段能试运行？
12. 是否能直接交给 LLM 分阶段开发？

输出自检报告，列出不符合项并修复。
```

---

## 15. 架构与代码自检清单

| # | 检查项 | 是否符合 |
|---|---|---|
| 1 | 是否高内聚？ | ✅ 每模块单一职责 |
| 2 | 是否低耦合？ | ✅ 模块经 Service 层协作 |
| 3 | 每个模块是否有明确输入/输出？ | ✅ 见模块契约 |
| 4 | 是否存在一个文件做太多事？ | ✅ 无 |
| 5 | 是否把 Prompt 拼接写进页面？ | ✅ 禁止，独立 PromptBuilder |
| 6 | 是否把 API Key 暴露到前端？ | ✅ 禁止，仅服务端 env |
| 7 | 是否引入无用依赖？ | ✅ 无 |
| 8 | 是否有 Mock 假结果？ | ✅ 禁止 |
| 9 | 是否保留合理扩展点？ | ✅ Polar/多租户/赛事 |
| 10 | 是否没有过度设计？ | ✅ 无微服务/消息队列 |
| 11 | 是否每阶段能试运行？ | ✅ 每 Phase 有 run check |
| 12 | 是否能直接交给 LLM 分阶段开发？ | ✅ 含阶段提示词模板 |

---

## 16. 复杂度评估

### 复杂度等级：High（高级）

### 评估依据（复杂度加项）
1. ✅ 登录认证
2. ✅ 角色权限（RBAC 三角色）
3. ✅ 管理后台（用户管理、审计日志）
4. ✅ 历史数据（训练记录、体能记录、健康指标）
5. ✅ 文件上传（照片）
6. ✅ 批量处理（Excel 导入）
7. ✅ 多模型切换（LLM Provider 抽象）
8. ✅ 数据看板（图表、趋势、对比）
9. ✅ 第三方集成预留（Polar）
10. ✅ PDF/DOCX 导出
11. ✅ 多格式输入（表单+Excel+CSV）
12. ✅ 数据库持久化
13. ✅ 审计日志

**复杂度计数：13 项 → High（5+ 为高级）**

### V1 功能
- 训练管理 + PB 追踪
- 体能测试与分析
- 健康伤病跟踪
- LLM 三场景（分析报告/伤病预警/查询助手）
- Excel 导入 + PDF/Word 导出
- RBAC + 审计日志

### V2+ 功能
- 赛事成绩管理
- 运动员个人端
- 多团队多租户
- Polar 实时同步

### 暂不实现
- 支付、SSO、移动端、公开 API、多语言切换

### 预留接口
- `POST /api/integrations/polar/data`
- `Athlete.teamId` / `User.teamId` 字段
- `Competition` / `CompetitionResult` 表结构预留

### 实现顺序
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8

---

## 附录：环境变量配置模板（.env.example）

```bash
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/ams_db"

# 认证
AUTH_SECRET="your-jwt-secret-key-change-in-production"

# LLM Provider 配置（多家可切换）
MODEL_PROVIDER="zhipu"  # zhipu | deepseek | qwen

# 智谱 GLM
ZHIPU_API_KEY=""
ZHIPU_MODEL="glm-4-plus"

# DeepSeek
DEEPSEEK_API_KEY=""
DEEPSEEK_MODEL="deepseek-chat"

# 通义千问
QWEN_API_KEY=""
QWEN_MODEL="qwen-max"

# LLM 调用参数
LLM_TEMPERATURE="0.3"
LLM_MAX_TOKENS="4096"

# 文件上传
UPLOAD_DIR="./public/uploads"
MAX_FILE_SIZE="5242880"

# 应用
APP_NAME="运动员管理系统"
APP_URL="http://localhost:3000"
```

---

> ✅ 本设计包已完成。可直接交给 Trae / Cursor / Claude Code 等 AI 编程工具，按 Phase 0 → Phase 8 顺序分阶段执行。每阶段完成后运行 `npm run build && npm run lint` 验收，通过后再进入下一阶段。
