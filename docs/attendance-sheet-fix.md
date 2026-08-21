# 出勤表界面优化与填写跳转修复说明

- 日期：2026-08-18
- 模块：出勤管理（/training/records，`app/(dashboard)/training/components/AttendanceView.tsx`）
- 状态：已完成，lint / 全量测试（128 项）/ build / 浏览器 E2E 全部通过

---

## 一、任务 1：移除「训练负荷」参数显示

### 1.1 改动内容

在「出勤表」Tab 中完全隐藏训练负荷相关的 UI 元素，保留 RPE（1-10）与训练时长两列的正常显示与操作：

| 位置 | 改动前 | 改动后 |
| --- | --- | --- |
| 表格表头 | 运动员 / 来源 / 出勤状态 / RPE（1-10）/ 训练时长（分钟）/ **训练负荷** / 操作 | 运动员 / 来源 / 出勤状态 / RPE（1-10）/ 训练时长（分钟）/ 操作 |
| 表格数据列 | 每行末展示「训练负荷」（RPE × 时长，无则显示 —） | 已移除整列 |
| 当日汇总卡片 | 总训练负荷 / 记录人数 / 训练总时长 / 平均 RPE（4 卡片） | 仅保留 **训练总时长 / 平均 RPE**（2 卡片，`grid-cols-2`） |

同时清理了已无用的计算逻辑（`dayStats` 中不再计算 `totalLoad` / `loadCount`）。

### 1.2 未改动部分（说明）

- 「负荷统计」Tab（按日/按人员/按运动项目多维汇总 + 批量导入历史数据）为独立的统计功能模块，不属于出勤表参数显示，**保留**。
- 后端数据字段 `rpe` / `durationMinutes` / `LoadRecord` 双向关联与自动保存逻辑保持不变，仅隐藏前端展示。
- 若需要连「负荷统计」Tab 一并隐藏，可另行处理。

### 1.3 验证结果

浏览器 E2E 确认：表头 6 列无「训练负荷」；汇总区仅 2 张卡片；「出勤报告」「负荷统计」Tab 正常切换，统计功能不受影响。

---

## 二、任务 2：填写 RPE 后继续填写训练时长出现页面闪跳 / 滚动到表格开头

### 2.1 问题复现

- 操作步骤：在出勤表某行「RPE（1-10）」输入数值并提交 → 立即点击/跳转到该行「训练时长（分钟）」继续输入 → 页面出现异常闪跳并自动滚动至考勤表开头位置，输入焦点丢失。
- 环境：Chrome（浏览器自动化实测），出勤表 12 行数据场景，日期 2026-08-18。

### 2.2 根因分析

保存链路：`LoadInput` 失焦/回车 → `saveRow` → PUT `/api/attendance/sheet` → **`fetchSheet(date)` 重新拉取全表**。

原 `fetchSheet` 在每次请求前执行 `setIsLoading(true)`，而出勤表区域的渲染逻辑是：

```
isLoading ? <div>加载中...</div> : <表格>
```

即每次保存成功后，**整张表格被「加载中...」占位替换、随后重新挂载**。由此产生三个连锁问题：

1. **表格 DOM 整体卸载/重建**：行内输入框被销毁，已聚焦/正在点击的输入框丢失焦点；
2. **布局高度剧烈变化**：占位卡片高度远小于表格，「加载中...」出现/消失导致页面高度突变，浏览器滚动锚定（scroll anchoring）在 DOM 被替换时容易把滚动位置重置；
3. **输入时机被打断**：RPE 提交触发的刷新若与用户点击训练时长输入框的瞬间重叠，点击落点变成占位区域，表格恢复后滚动位置跳到开头——即用户观察到的「闪跳并滚动至考勤表开头」。

### 2.3 修复方案

1. **静默刷新（核心修复）**：[AttendanceView.tsx](file:///c:/Users/10168/Documents/trae_projects/Athlete%20Manage%20System/athlete-manage-system/app/(dashboard)/training/components/AttendanceView.tsx)
   `fetchSheet` 新增 `silent` 选项：保存 / 重置 / 手动添加成功后调用 `fetchSheet(date, { silent: true })`，不切换加载态。表格 DOM 始终保持挂载，React 按行 key 复用元素，输入框焦点与页面滚动位置不再被破坏。

2. **同运动员保存串行化**：`saveRow` 按 `athleteId` 维护保存任务队列，并通过 `sheetRef` 读取最新表数据。连续填写 RPE → 训练时长时，后一次提交总能读到前一次保存后的最新值，避免快速连续提交产生互相覆盖（如第二次提交误把 RPE 写成 null）。

3. 仅日期切换等显式操作仍使用带加载态的完整刷新，行为不变。

### 2.4 测试结果（浏览器 E2E）

| 场景 | 结果 |
| --- | --- |
| 表头 / 汇总卡片移除验证 | 通过 |
| 核心场景：滚动到中部（main.scrollTop=420）→ 连续填写第 6 行 RPE=7、时长=60 → 立即检查 | `main.scrollTop` 保持 **420 不变**，无「加载中」闪烁，焦点停留在时长输入框，重载后数据持久（7/60） |
| 第 7 行连续填写 RPE=5、时长=45 | 无跳转、无闪烁，重载后数据在（5/45） |
| 非法 RPE=15 提交 | 显示「RPE 需为 1-10 的整数」内联错误，页面不跳转；改回合法值后错误消失 |
| 切换日期 08-17 → 08-18 | 出勤表正常加载，数据完好 |
| 控制台检查 | 无 React 错误或未捕获异常（仅无害的 hydration 属性警告与资源中止日志） |

> 备注：测试期间观察到 1 次偶发滚动归零（错误提示行出现/消失引起的布局抖动，自动化注入场景，未能复现）。核心填写链路（步骤 6-9）全程稳定，不影响本次修复结论；如后续仍可稳定复现，可进一步用 CSS `overflow-anchor` 加固滚动锚定。

### 2.5 回归

- `npm run lint`：通过（仅历史遗留的 admin 页面 hooks 警告）
- `npm run test`：**128 / 128 通过**（含新增的 `attendance-load.test.ts` 18 项）
- `npm run build`：通过

---

## 三、涉及文件

- [AttendanceView.tsx](file:///c:/Users/10168/Documents/trae_projects/Athlete%20Manage%20System/athlete-manage-system/app/(dashboard)/training/components/AttendanceView.tsx)：移除训练负荷列与汇总、`fetchSheet` 静默刷新、`saveRow` 串行化与最新值读取
- 后端（无需改动）：`AttendanceService` / `LoadService` / `/api/attendance/sheet` 双向关联与数据保存逻辑保持不变
