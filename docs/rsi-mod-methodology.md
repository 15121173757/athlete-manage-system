# RSI-mod（修正反应力量指数）计算方法说明

> 适用范围：跳跃视频分析工具 · 10-5 重复跳测试报告
> 更新日期：2026-08-19

## 1. 定义与标准公式

**RSI-mod（Modified Reactive Strength Index，修正反应力量指数）** 的标准定义为跳跃高度与「离地时间」（time to take-off, TTT）之比：

```
RSI-mod = 跳跃高度 JH (m) / 离地时间 TTT (s)
```

其中：

- **跳跃高度（JH）**：单位米。本工具采用飞行时间法计算：`JH = g·t²/8`（t 为腾空时间，g = 9.80665 m/s²）。
- **离地时间（TTT）**：单位秒。指从动作起始（离心阶段开始）到起跳离地的时间。

该公式由 **Ebben & Petushek (2010)** 首次提出，用于将传统 RSI（跳深跳中使用）扩展到无需跳箱/触地测量的地面起跳动作（如下蹲跳 CMJ），并以 TTT 替代触地时间。

## 2. 本工具（10-5 重复跳）采用的计算口径

在 **10-5 重复跳**（连续快速反弹跳）中，每次跳跃的「离地时间」即上一次落地到本次起跳之间的**触地时间**（GCT）——因为离心制动阶段始于触地瞬间（Hawkin Dynamics 明确指出连续跳/跳深场景下 Contact Time 与 Time to Take-off 可互换使用）。此时标准公式 `JH/TTT` 与系统已报告的 `RSI = JH/GCT` 数值重合，单独呈现会造成指标冗余。

因此，本工具在 10-5 报告中采用**飞行时间归一化的实用变体**：

```
RSI-mod = 跳跃高度 JH (m) / 飞行时间 FT (s)
```

推导等价形式：`RSI-mod = (g·t²/8) / t = g·t/8 = 起跳速度 v / 2`

### 为什么采用此口径

1. **可计算性**：本工具为视频手动帧标记（仅测量飞行时间与触地时间），无法从视频可靠识别「动作起始帧」，无法测量标准 TTT；飞行时间法只需飞行时间即可得到每跳 RSI-mod。
2. **互补性**：`RSI（高度/触地时间）`衡量「从地面快速反弹的能力」，`RSI-mod（高度/飞行时间）`衡量「单位腾空时间产生高度的效率」，两者结合可区分「触地时间短但腾空高度不足」与「腾空高但触地长」两类跳跃特征。
3. **单位**：与 RSI 一致，为 m/s（无量纲使用）。

> 注意：此变体与力台场景下以 TTT 为分母的标准 RSI-mod 数值口径不同，**不可跨协议直接比较**；同一运动员在同协议下的纵向趋势比较是有效的。

## 3. 参数解释

| 参数 | 符号 | 单位 | 说明 |
|---|---|---|---|
| 飞行时间 | FT / t | ms → s | 起跳离地至落地的腾空时间（视频帧标记获得） |
| 触地时间 | GCT | ms → s | 落地至下一次起跳的接地时间（视频帧标记获得） |
| 跳跃高度 | JH | cm → m | `JH = g·t²/8`，飞行时间法推算 |
| 起跳速度 | v | m/s | `v = g·t/2` |
| RSI | — | m/s | `JH / GCT`，反应力量指数（触地归一化） |
| RSI-mod | — | m/s | `JH / FT = g·t/8 = v/2`，修正反应力量指数（飞行时间归一化） |

## 4. 10-5 报告中的汇总指标

- **平均 RSI-mod**：各次有效跳跃 RSI-mod 的算术平均。
- **RSI-mod 变异系数（CV%）**：`SD/均值 × 100`（样本标准差，n≥2 时计算），用于评估各次跳跃表现稳定性；CV 越低越稳定。
- **逐跳明细**：每条记录均输出该跳的 `rsiMod`，表格与折线图（RSI 与 RSI-mod 双 Y 轴）中展示。

## 5. 参考资料来源

1. **Ebben, W.P. & Petushek, E.J. (2010).** Using the reactive strength index modified to evaluate plyometric performance. *Journal of Strength and Conditioning Research*, 24(8), 1983–1987. — 提出 RSI-mod（JH/TTT）术语与公式。
2. **Suchomel, T.J., Bailey, C.A., Sole, C.J., Grazer, J.L. & Beckham, G.K. (2015).** Using reactive strength index-modified as an explosive performance measurement tool in Division I athletes. *Journal of Strength and Conditioning Research*, 29(4), 899–904. — RSI-mod = JH/TTT，ICC 0.96–0.98，可靠性验证。
3. **Sole, C.J., Suchomel, T.J. & Stone, M.H. (2018).** Preliminary scale of reference values for evaluating reactive strength index-modified in male and female NCAA Division I athletes. *Sports*, 6(4), 133. — 明确 `RSI_mod = CMJ height (m) / time to takeoff (s)`，并给出参考值区间（男 0.208–0.704，女 0.135–0.553）。
4. **Vieira, A. & Tufano, J.J. (2021).** Reactive strength index-modified: reliability, between group comparison, and relationship between its associated variables. *Biology of Sport*, 38(3), 451–457. — RSImod = JH ÷ TTT，组间比较与信度。
5. **Louder, T., Thompson, B.J. & Bressel, E. (2021).** Association and agreement between reactive strength index and reactive strength index-modified scores. *Sports*, 9(7), 97. — RSI 与 RSI-mod 不可互换，强调口径差异。
6. **Heishman, A.D., et al. (2019).** The influence of countermovement jump protocol on reactive strength index modified and flight time:contraction time. *Sports*, 7(2), 37. — 飞行时间法计算 RSI-mod（RSI_mod_FT）。
7. **Harper, D., Hobbs, S.J. & Moore, J. (2011).** The ten to five repeated jump test: a new test for evaluation of reactive strength. BASES Student Conference. — 10-5 重复跳测试原始协议（RSI = JH/GCT）。
8. **Stratford, C., Dos'Santos, T. & McMahon, J.J. (2020).** Comparing drop jumps with 10/5 repeated jumps to measure reactive strength index. *Professional Strength & Conditioning*, 57, 23–31. — 10-5 协议 RSI 应用与信度（ICC = 0.975, CV = 6.3%）。
9. **Hawkin Dynamics.** Reactive Strength Index Course & Metric Database. — 说明连续跳/跳深场景下 Contact Time 与 Time to Take-off 可互换，RSI 与 mRSI 定义。

## 6. 实现位置

- 计算函数：`lib/sport-science/jump-analysis.ts` → `heightAndFlightTimeToRsiMod`、`computeSingleJumpMetrics`、`summarizeRepeatJumps`
- 前端展示：`app/(dashboard)/tools/components/JumpAnalysisTool.tsx` → 10-5 结果卡片、逐跳表格、双轴折线图与解读文本
- 单元测试：`tests/jump-analysis.test.ts`
