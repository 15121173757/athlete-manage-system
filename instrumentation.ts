/**
 * Next.js 服务端启动钩子 —— 训练计划与体能测试计划状态定时刷新
 *
 * 每小时执行一次，自动将「执行时间已过」的待执行计划更新为已执行，
 * 保证在无用户访问列表/详情时状态也能随时间自动流转。
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const run = async () => {
    try {
      const { refreshAllPlanStatuses } = await import('./lib/modules/training/planStatus');
      const { refreshAllFitnessPlanStatuses } = await import('./lib/modules/fitness/fitnessPlanStatus');

      const [trainingChanged, fitnessChanged] = await Promise.all([
        refreshAllPlanStatuses(),
        refreshAllFitnessPlanStatuses(),
      ]);
      if (trainingChanged > 0 || fitnessChanged > 0) {
        console.log(
          `[plan-status] 定时刷新完成，更新 ${trainingChanged} 条训练计划、${fitnessChanged} 条体能测试计划状态`
        );
      }
    } catch (error) {
      console.error('[plan-status] 定时刷新失败', error);
    }
  };

  // 启动时立即刷新一次，之后每小时刷新一次
  await run();
  const timer = setInterval(run, 60 * 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
}
