# 视频跳跃分析工具 技术可行性评估报告

> 版本：v1.0 ｜ 日期：2026-08-19 ｜ 状态：可行性研究（仅分析，不含开发）
> 目标：评估在现有运动科学工具集（/tools）中新增「视频跳跃生物力学分析工具」（功能对标 My Jump Lab）的技术可行性。

---

## 1. 执行摘要（结论先行）

| 结论项 | 结论 |
| --- | --- |
| 核心算法可行性 | ✅ 可行。跳跃高度/飞行时间测量算法成熟（h = g·t²/8），已获大量同行评审验证 |
| 技术路线 | ✅ 可行。建议采用「人工/半自动关键帧标记 → 姿态估计自动检测 → 全自动 AI 分析」渐进路线 |
| Web 端（本项目技术栈）限制 | ⚠️ 存在。浏览器 getUserMedia 高帧率采集受限（常规 60fps，iOS Safari 无慢动作直采），高精度场景需「导入外部慢动作视频」或「桌面端/PWA」路线 |
| 精度目标 | ✅ 可达。视频分析法 vs 测力台：ICC ≥ 0.99、偏差 < 1 cm（240fps 视频 + 正确标记，误差约 0.7%） |
| 实时性要求 | ⚠️ 部分满足。逐帧姿态估计在浏览器端可达 20-40fps（桌面）/ 10-34fps（移动端），但 240fps 慢动作全自动实时分析建议采用「事后分析」而非逐帧实时 |
| 移动端适配 | ✅ 可达。Web 自适应布局 + 摄像头采集（60fps）+ 视频导入，PWA 化可覆盖 iOS/Android |
| 数据准确性验证 | ✅ 可行。可复现公开文献中的验证协议（测力台/Optojump 对照、Bland-Altman、ICC），本项目可引入对照测试流程 |
| 总体可行性 | **✅ 可行**（建议以 P0 最小可行版本起步，分阶段交付） |

---

## 2. My Jump Lab 核心功能、技术架构与算法原理

### 2.1 产品定位与功能清单

My Jump Lab（My Jump 3，开发者 Carlos Balsalobre，马德里自治大学运动科学家）是**全球使用最广泛的手机运动表现测量应用**：官方披露 400k+ 下载、140+ 国家使用、20+ 项同行评审研究验证、App Store 评分 4.7（373 评价，中国区）。

功能矩阵（与跳跃分析直接相关的）：

| 类别 | 具体测试 |
| --- | --- |
| 跳跃 | CMJ（下蹲跳）、SJ（静态蹲跳）、带自由臂 CMJ、DJ（跳深）、**最佳力-速度剖面**、RSI-mod、水平跳、腿部不对称、**10-5 重复跳跃测试** |
| 力-时间分析 | 加速度计实时力曲线、平均推进速度、起跳时间（time to take-off） |
| 运动捕捉 | 无标记运动捕捉实时测量膝内翻/外翻、深蹲深度（需 A12 芯片及以上） |
| 视频 AI | 导入视频自动测量 CMJ/SJ（AI 模式）；实时 AI 标记（原 App 即有） |
| 平台能力 | 多用户、iCloud 同步、历史记录、CSV 导出、慢动作视频导入（远程测试） |

### 2.2 测量算法原理（核心）

**（1）跳跃高度——飞行时间法（核心算法）**

```
h = g · t² / 8
```

- 原理：腾空后人体质心做纯抛体运动，上升/下落对称各占 t/2，代入 h = ½g(t/2)² 化简即得。
- t（飞行时间）= 起跳离地帧到落地帧之间的时间差。
- 关键事件定义：**起跳 = 双脚离地的第一帧；落地 = 任一只脚触地的第一帧**（Pueo 2023 三项观察者协议）。
- 附带参数：起跳速度 v₀ = g·t/2；Sayers 峰值功率估算 PP(W) ≈ 60.7×h(cm) + 45.3×体重(kg) − 2055。

**（2）RSI-mod（修正反应力量指数）**

```
RSI-mod = 跳跃高度 / 起跳时间（time to take-off）
```

- 起跳时间定义为从下蹲（countermovement）开始到离地的时长。
- 关键经验（Bishop 2022）：My Jump Lab 早期起跳时间存在 0.075s 系统偏差，加入**修正系数**后偏差归零（g = 0.00），RSI-mod 偏差从 -0.048 降至 0.006。**→ 本项目若实现 RSI-mod，必须内建修正系数。**

**（3）10-5 重复跳跃测试（Repeat Jump Test）**

- 要求连续 10 次最大努力跳跃，记录每次触地/腾空时间，计算平均跳跃高度、接触时间、RSI（height/contact time）、RSI 变异系数。需要连续检测**多次起跳-落地事件**。

**（4）不对称性（Asymmetry）**

- 单腿 CMJ 双腿对比，或跳跃腾空/触地时间左右对比（研究证实 My Jump 2 的 flight time symmetry ICC 0.921-0.982）。

**（5）力-速度剖面（跳跃法）**

- 通过 SJ/CMJ + 不同负荷跳跃反推力-速度关系（与项目现有 FVP Profile 工具同源，可用作集成点）。

### 2.3 技术架构与数据采集方法

- **硬件**：仅用 iPhone/iPad 摄像头。高帧率慢动作录制（120/240fps 为实测基准；部分新机型 480-960fps）。
- **采集规范**：三脚架固定、正面额状面拍摄（聚焦双脚，观测起跳/落地）、距离约 1.5m、相机高度约 30cm（Pueo 2023 协议）。
- **AI 实现**：官方披露「先进计算机视觉 + 人工智能 + 实时测量」。运动捕捉功能基于 Core ML 在设备端运行（要求 A12 芯片，即 iPhone XR/iPad Pro 2018+）。AI 模式下可直接在导入视频中自动放置起跳/落地标记。
- **商业模式**：免费 + 订阅制（$5.99/月，中国区 ¥328/年 或 ¥998 买断），7 天试用。数据仅存本地/用户 iCloud，不收集个人数据。
- **验证证据体系**（关键数据，本项目可复现）：
  - My Jump 2 vs 测力台：CMJ/DJ 高度 ICC 0.991-0.993；CMJAM ICC 0.998-0.999；CMJAM 累计高度 r = 0.999。
  - My Jump 2 vs Optojump（光栅）：SJ r=0.95、CMJ r=0.98、CMJAS r=0.98。
  - My Jump 3 vs K-Deltas 便携测力台（2025）：r/ρ ≥ 0.96，偏差 ≤ 0.59cm，CCC ≥ 0.966，R² ≥ 0.937；重测 ICC ≥ 0.947，CV < 7.1%。
  - My Jump Lab vs OptoJump（2026，76 名羽毛球运动员）：ICC₂,₁ ≥ 0.990，均值差 < 1cm，95% LOA −3.26 ~ 2.28cm，R² > 0.98；存在轻微系统性高估，CMJAM 存在比例偏差（随高度增大而增大）。
  - 操作者经验影响：无经验 vs 有经验操作者 ICC₂,₁ ≥ 0.983（0.992/0.992/0.983），操作者经验对结果影响不显著。

---

## 3. 视频运动分析技术现状

### 3.1 帧率精度研究（直接影响产品精度设计）

Pueo et al.（Biol Sport 2023）对 1000fps 高速视频降采样至 120/240/480Hz 后由 3 名观察者用 MyJump 分析：

| 帧率 | 飞行时间技术误差 | 跳跃高度技术误差 | 评价 |
| --- | --- | --- | --- |
| 120 Hz | 3.4 ms | 1.4% | 相对精英运动员间差异（~12%）或最小可检测变化（~3%）而言偏大 |
| 240 Hz | 1.8 ms | 0.7% | **可忽略** |
| 480 Hz | 1.2 ms | 0.5% | 提升有限 |
| 1000 Hz | 0.8 ms | 0.3% | 与实验室设备相当，但成本高 |

**结论：240fps 是精度/成本甜点。高于 240fps 不会显著改善精度。本项目应把 240fps 作为测量建议规格，同时兼容 120fps（提示误差）与 60fps（普通模式，误差 ~2.8%，仅用于粗测）。**

### 3.2 姿态估计/人体关键点模型现状

| 模型 | 类型 | 关键点 | 许可 | 说明 |
| --- | --- | --- | --- | --- |
| MediaPipe BlazePose | 轻量单目 2D/3D | 33 | Apache-2.0 | 专为健身/瑜伽设计，含脚部关键点，TF.js/MediaPipe WASM 均可用，实时性好 |
| MoveNet (Lightning/Thunder) | 轻量单目 2D | 17 | Apache-2.0 | 推理最快，适合低端移动端 |
| OpenPose | 研究级多目标 | 18/25/135 | 科研许可 | 经典 BCNN，UCD 研究用其做单手机 CMJ 分析 |
| MMPose (OpenMMLab) | 训练/推理框架 | 17/133 | Apache-2.0 | 2024 塞尔维亚研究验证其 CMJ 精度 r>0.98 |
| HRNet / AlphaPose | 高精度 | 17 | MIT/Apache | 精度高、速度慢，适合事后分析 |
| YOLO-pose / RTMPose | 实时检测 | 17 | Apache | RTMPose 速度极快，适合实时 |

**浏览器端实测性能（BlazePose full 模型）：**

| 设备 | TF.js WebGL 后端 | MediaPipe WASM+GPU |
| --- | --- | --- |
| MacBook Pro 15" (i9) | 48 fps | 92 fps |
| iPhone 11/12 | 34 fps | 不支持（需 MediaPipe 原生） |
| Pixel 5 | 12 fps | 32 fps |
| 桌面 GTX1070 | 44 fps | 160 fps |

**结论：桌面浏览器 40-90fps、移动端 10-34fps 的姿态估计是可行的；但无法对 240fps 视频逐帧实时推理（帧率不匹配）。正确架构是「逐帧离线推理 + 事件检测」或「实时预览用 30-60fps 模式 + 事后用慢动作视频精测」。**

### 3.3 无标记视频测量的验证数据（核心可实现性证据）

| 研究 | 方法 | 对照基准 | 结果 |
| --- | --- | --- | --- |
| Aderinola 2023 (arXiv) | 单手机 + OpenPose | 测力台 + 光学动捕 | 跳跃高度 ICC 0.84-0.99，无需相机标定与人工分割 |
| Aleksic 2024 (Sensors) | MMPose 无标记 | 3D 标记动捕 | 多数变量 r > 0.98，ICC > 0.91，轻微高估高度 |
| Barzyk 2024 (Eur J Sport Sci) | AI 智能手机（iPhone X 4K） | VICON | 髋 r=0.96、膝 r=0.99、踝 r=0.87；MSE < 5.7°，MAE < 4.5° |
| Guignard 2025 (SBM) | MediaPipe + iPad Pro 120Hz | Qualisys 动捕 | 飞行时间差 0.7%，跳跃高度差 1.53%，关键点 RMSE 24.26 mm |
| OpenCap 2026 (Sci Rep) | 2-4 手机无标记 | 标记动捕 | DJ 落地动力学 ACL 风险指标验证有效 |

**Guignard 2025 提供可直接复用的自动事件检测规则**：
- 校准：起跳前站立姿势高度作为像素→米比例尺（或使用受试者身高）。
- 起跳（toe-off）：脚趾关键点垂直位置高于基线 5mm。
- 蹬伸开始（push-off initiation）：肩部关键点高于下蹲基线 2cm。
- 落地：脚趾垂直位置回落到基线附近。
- 数据滤波：4 阶低通 Butterworth，截止 8Hz。

---

## 4. 技术栈与开发资源评估（结合本项目）

### 4.1 现状与本工具定位

- 项目现状：Next.js 14.2 + TypeScript + Prisma + SQLite + Tailwind + shadcn/ui；/tools 已有 6 个纯计算类工具（心率强度/FVP/1RM/需求分析/VO₂max/FMS）。
- 本工具是**首个视频+AI 类工具**，需要引入媒体处理与姿态估计能力。
- 数据集成点：运动员档案、出勤/负荷监控（RPE×时长）、FVP Profile（力-速度剖面跳跃法同源）、训练计划与 PB 追踪（跳跃成绩可入 PB）。

### 4.2 推荐技术路线（三阶段渐进）

| 阶段 | 方案 | 技术要点 | 精度 | 工作量 |
| --- | --- | --- | --- | --- |
| **P0 手动标记版（MVP）** | 上传/录制视频 → 逐帧拖拽标记起跳/落地 → 计算 | `requestVideoFrameCallback`、canvas 帧导览、帧步进 | 240fps 下约 0.7% | 最小（2-4 周） |
| **P1 半自动版** | 姿态估计辅助：自动检测离地/落地帧，人工复核 | @tensorflow-models/pose-detection（BlazePose/MoveNet） | 同上 + 复核保障 | 中等 |
| **P2 全自动版** | 多跳连续检测（10-5 测试）、RSI-mod、不对称性、AI 自动标记 | 事件检测 + 信号处理（Butterworth、峰值检测） | 接近文献水平 | 较大 |

### 4.3 Web 端能力边界（关键技术约束）

| 能力 | Web 现状 | 影响与对策 |
| --- | --- | --- |
| 高帧率采集 | 桌面 Chrome 支持 60fps；`getUserMedia` 多数浏览器上限 60fps；iOS Safari 无法直采慢动作 | **主测量流程建议「导入外部慢动作视频（120/240fps）」**；实时预览用 60fps 做粗测 |
| 视频解码 | `requestVideoFrameCallback` + WebCodecs（Chromium）逐帧精确步进 | P0 标记版核心依赖，需检测兼容性并提供降级方案 |
| 姿态推理 | BlazePose/MoveNet TF.js（WebGL/WASM）桌面 40-90fps、移动 10-34fps | 离线逐帧推理可行；实时 AI 需限制在 30fps 预览模式 |
| 移动端 | 本项目为响应式 Web | 通过 PWA（可安装、摄像头采集、本地存储）覆盖移动需求；不做原生 App |
| 像素比例尺 | 需要参考物/身高校准 | 方案：录入身高 + 起跳前站立帧标定，或放置已知长度标尺 |

### 4.4 推荐依赖清单

```
前端（浏览器内）：
- @tensorflow-models/pose-detection（BlazePose / MoveNet，Apache-2.0）
- @tensorflow/tfjs-backend-webgl 或 @mediapipe/pose（WASM）
- 可选：@tensorflow-models/movenet（低端机）
视频处理：
- ffmpeg.wasm（转码/降采样/抽帧，可选）
后端：
- 无新增重型依赖；视频文件存本地/可选上传（需注意体积）
```

**许可合规**：BlazePose/MoveNet/MMPose/RTMPose 均为 Apache-2.0（可商用）；OpenPose 为科研许可（**避免在商业产品中使用**）；Kinovea 为 GPL（仅借鉴思路，不抄代码）。

### 4.5 开发资源需求

| 角色 | 职责 | 建议投入 |
| --- | --- | --- |
| 前端工程师 | 视频组件、帧导览、PWA、UI（本项目现有） | 1 人为主 |
| ML/计算机视觉工程师 | 姿态模型接入、事件检测算法、精度调优 | 1 人（P1/P2 阶段） |
| 运动科学顾问 | 测试协议、结果解释、验证对照 | 兼职/外包 |
| 测试 | 浏览器矩阵 + 真实跳跃视频验证集 | 1 人（可复用现有测试体系） |

---

## 5. 市场同类产品分析

| 产品 | 技术路线 | 价格 | 优势 | 用户反馈要点 |
| --- | --- | --- | --- | --- |
| **My Jump Lab**（对标产品） | 手机摄像头 + AI（Core ML），iOS/Android/Mac | 订阅 $5.99/月（¥328/年、¥998 买断） | 20+ 论文验证、生态最全（30+ 测试）、CSV 导出、远程视频 | 4.7 分；有「闪退且扣费」等少量差评；需订阅 |
| VertVision | 手机视频 + AI 自动标记 | 免费/买断 | Android 可用、自动检测 | 与 My Jump 可靠性相当（2025 手球研究） |
| Jumpo 2 | 手机视频 + 手动标记 | 低价 | Android、可靠性接近测力台 | 人群适用性需谨慎（飞行时间法局限） |
| Kinovea | 桌面开源软件，手动标记 | 免费（GPL） | 功能强大、成熟 | 非移动端、需人工逐帧，体验门槛高 |
| Output Sports | **IMU 穿戴传感器**（腿/臂套） | 订阅 | 实时力/功率，无需视频 | 需佩戴硬件，采集协议受限 |
| KINVENT | 便携测力台 + 应用生态 | 高（硬件） | 力-时间曲线精度高 | 硬件成本高，非视频方案 |
| Optojump | 光栅光电（实验室金标准参考） | 很高（硬件） | 触地/腾空时间精确 | 不可移动、昂贵 |

**竞品启示**：
1. 视频分析法（My Jump/VertVision/Jumpo）是**低成本路线的主流**，验证充分；IMU（Output）与测力台（KINVENT）为高价补充。
2. 差异化机会：本工具为**免费 Web/PWA + 中文 + 与现有 FVP/负荷/训练计划深度集成**，这是 My Jump 不具备的（My Jump 为独立 App，数据不互通）。
3. 用户对「精度可信」与「订阅价格」敏感；本项目免费策略 + 引用公开验证数据作为卖点。

---

## 6. 开源项目与学术依据（算法可实现性验证）

### 6.1 开源项目

| 项目 | 用途 | 许可 | 可行性结论 |
| --- | --- | --- | --- |
| MediaPipe (google/mediapipe) | 姿态估计、脚部关键点（适合起跳/落地检测） | Apache-2.0 | ✅ 直接可用 |
| tfjs-models / pose-detection | TF.js 版 BlazePose/MoveNet 推理 | Apache-2.0 | ✅ 直接可用（本项目主选） |
| MMPose | 训练/推理姿态模型（精度验证研究支持） | Apache-2.0 | ✅ 可作备选/离线批处理 |
| OpenCap (stanfordnmbl/opencap-processing) | 无标记 3D 运动捕捉（2-4 手机） | 参考实现 | ✅ 借鉴方法学（本项目无需 3D） |
| Kinovea | 桌面视频分析（跳跃高度功能） | GPL | ⚠️ 仅借鉴，不集成（许可不同） |
| ffmpeg.wasm | 视频抽帧/降采样 | MIT | ✅ 可选依赖 |

### 6.2 关键学术依据

- **飞行时间法**：h = g·t²/8，已被测力台/光栅/接触垫多设备验证（MyJump 原生算法）。
- **帧率-精度曲线**：240Hz 以上误差可忽略（Pueo 2023）。
- **无标记测量**：单手机 ICC 0.84-0.99（Aderinola 2023）；MMPose r>0.98（Aleksic 2024）；MediaPipe 高度差 1.53%（Guignard 2025）。
- **RSI-mod 修正系数**：time-to-take-off 需内建校正（Bishop 2022）。
- **自动事件检测规则**：脚趾离地 5mm、肩部 2cm 阈值 + 8Hz Butterworth（Guignard 2025）。
- **操作者/自动一致性**：经验影响不显著（2026 Frontiers）。

**结论：核心算法（飞行时间→高度、RSI-mod、10-5 事件检测）均有文献级实现路径可复现，P0 阶段甚至不依赖 ML 即可交付可信 MVP。**

---

## 7. 关键技术难点、解决方案、开发周期与资源

### 7.1 关键技术难点与对策

| # | 难点 | 风险等级 | 解决方案建议 |
| --- | --- | --- | --- |
| D1 | 高帧率采集（240fps）在 Web 受限 | 高 | 主流程=导入慢动作视频；实时预览 60fps 粗测；文档化「慢动作采集规范」引导用户用手机原生相机录制 |
| D2 | 逐帧精确步进与事件标记准确性 | 高 | `requestVideoFrameCallback` + canvas；键盘逐帧；放大脚部区域辅助；帧号精确显示 |
| D3 | 自动起跳/落地检测误判（鞋色/遮挡/运动模糊） | 中 | 多信号融合（脚部关键点+位移+速度变化率）；人工复核兜底；置信度提示 |
| D4 | 像素→米标定误差 | 中 | 站立帧高度/已知标尺双标定；不标定模式仅输出时间类指标（flight time、contact time、RSI 无需绝对尺度） |
| D5 | 移动端实时 AI 帧率不足（10-34fps） | 中 | 实时模式限定 30fps + lite 模型；精测用离线分析慢动作视频 |
| D6 | 多跳连续检测（10-5 测试） | 中 | 事件序列状态机 + 最小腾空时间阈值过滤噪声；P2 阶段实现 |
| D7 | 数据准确性验证（用户信任） | 中 | 内建「对照验证模式」：与 Optojump/测力台对比给出偏差报告；引用公开文献数据；发布验证文档 |
| D8 | 视频存储与隐私 | 低 | 视频默认本地（IndexedDB），不上传；导出仅存指标，不存视频；符合项目「敏感数据仅本地临时」约束 |
| D9 | 相机与浏览器兼容性矩阵 | 低 | 检测 getDisplayMedia/getUserMedia/WebCodecs 能力并降级提示 |

### 7.2 功能优先级与开发周期预估

| 阶段 | 交付内容 | 周期（估算） | 里程碑验收标准 |
| --- | --- | --- | --- |
| P0 MVP | 视频导入/录制 + 手动逐帧标记起跳/落地 + 飞行时间法计算（SJ/CMJ/DJ 高度、飞行时间）+ 结果保存/历史/CSV + 运动员关联 | 2-4 周 | 240fps 视频手动标记误差 < 1cm（对照文献基准）；lint/test/build 全绿 |
| P1 半自动 | 姿态估计辅助自动检测 + 人工复核 + 结果明细（起跳/落地帧标注回放）+ RSI-mod（含修正系数） | 3-5 周 | 自动检测 + 复核后与手动标记结果 ICC ≥ 0.95 |
| P2 全自动 | 10-5 重复跳跃、接触时间、RSI、不对称性、批量视频分析、AI 自动全流程 + 对照验证模式 | 4-8 周 | 与公开文献同量级精度（r ≥ 0.95，偏差 < 1.5cm） |
| P3 集成扩展 | 与 FVP Profile/负荷监控/PB 打通，跳跃成绩进入运动员档案与训练建议 | 2-3 周 | 端到端数据链路完整 |

**合计（P0-P3）：约 3-5 个月（单工程师 + 兼职运动科学顾问），1 名前端主程 + 0.5 ML 资源。**

> 说明：以上为相对工作量估算，实际取决于人力资源复用与既有代码基础（本项目 UI/权限/数据层可直接复用）。

### 7.3 风险与对策总览

| 风险 | 等级 | 对策 |
| --- | --- | --- |
| Web 高帧率限制导致精度口碑风险 | 高 | 明确「建议 240fps 慢动作视频导入」交互；60fps 模式标注精度限制 |
| 姿态模型误检导致结果不信任 | 中 | 永远提供人工复核；结果页显示置信度与关键帧缩略 |
| 与竞品（My Jump）功能差异不足 | 中 | 强调集成价值（中文 + 免费 + 训练闭环），而非纯对标 |
| 精度验证成本 | 中 | 自采小样本对照（Optojump/便携测力台）+ 公开数据集复现 |

---

## 8. 结论

1. **技术可行**：核心算法（飞行时间法、RSI-mod、事件检测）成熟且被大量同行评审研究验证；无标记姿态估计（BlazePose/MoveNet/MMPose）在浏览器端性能足以支撑 P1/P2 自动分析。
2. **路线清晰**：P0 手动标记 MVP（不依赖 ML）→ P1 姿态辅助 → P2 全自动多跳分析 → P3 生态集成，风险逐级可控。
3. **主要约束是 Web 高帧率采集**，通过「导入慢动作视频」的产品设计规避；精度目标 240fps 下误差 < 1cm（0.7%）可达。
4. **差异化优势**：本项目免费、中文、Web/PWA 全平台，且能与现有 FVP Profile、负荷监控（RPE×时长）、训练计划与 PB 追踪形成运动科学闭环——这是独立 App（My Jump Lab）不具备的集成价值。
5. **建议**：批准立项后按 P0 → P3 分阶段开发，每个阶段以 lint/test/build + 精度对照验收为门槛；P0 阶段即可产生对教练可用的真实价值。

---

## 9. 参考来源

- My Jump Lab App Store 页面（功能/定价/评分）：https://apps.apple.com/cn/app/my-jump-lab-my-jump-3/id1554077178
- 官方站 myjumplabpro.com（产品/作者/验证信息）：http://www.myjumplabpro.com/
- Bishop et al., 2022（My Jump Lab RSI-mod 效度与修正系数，J Hum Kinet）：https://pmc.ncbi.nlm.nih.gov/articles/PMC9465756/
- Tsaousidis et al., 2025（My Jump 2/3 vs K-Deltas 测力台，JPES）：https://efsupit.ro/images/stories/september2025/Art%20209.pdf
- Yang et al., 2026（My Jump Lab vs OptoJump，Frontiers）：https://public-pages-files-2025.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2025.1719436/pdf
- Pueo et al., 2023（帧率精度，Biol Sport）：https://pmc.ncbi.nlm.nih.gov/articles/PMC10108745/
- Aderinola et al., 2023（单手机无标记 CMJ，arXiv）：https://arxiv.org/pdf/2302.10749.pdf
- Aleksic et al., 2024（MMPose vs 3D 动捕，Sensors）：https://pmc.ncbi.nlm.nih.gov/articles/PMC11511341/
- Barzyk et al., 2024（AI 智能手机关节角度 vs VICON，Eur J Sport Sci）：PMID 39205332
- Guignard et al., 2025（MediaPipe 蹲跳试点，SBM）：https://slovo.episciences.org/fr/articles/16159/download
- Silva et al., 2021（运动类 App 效度系统综述，Sensors）：https://pmc.ncbi.nlm.nih.gov/articles/PMC8070051/
- Peng et al., 2024（My Jump 2 CMJAM/对称性，PeerJ）：DOI 10.7717/peerj.17658
- TensorFlow.js BlazePose（性能数据）：https://blog.tensorflow.org/2021/05/high-fidelity-pose-tracking-with-mediapipe-blazepose-and-tfjs.html
- OpenCap 跳深验证（Sci Rep 2026）：https://www.nature.com/articles/s41598-026-44758-0
