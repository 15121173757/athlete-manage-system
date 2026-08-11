/**
 * 训练器材简笔画图标注册表 —— 运动管理（AMS）
 *
 * 统一设计规范：
 * - viewBox: 0 0 48 48（统一尺寸，便于界面整齐排列）
 * - 线稿风格：stroke 描边、fill none、线条圆角
 * - 外层 <svg> 统一设置 stroke="currentColor"、stroke-width="2.5"
 * - 每个图标保留可辨识细节（重量片、滑轮、跑带、虚线光束等）
 *
 * 用途：创建练习 / 测试动作时以选择简笔画的形式快速识别与选择所需器材。
 */

export interface EquipmentIconDef {
  key: string;
  label: string;
  /** 图标内部 SVG 标记（不含 <svg> 根节点，颜色/描边继承外层） */
  svg: string;
}

export const EQUIPMENT_ICONS: EquipmentIconDef[] = [
  {
    key: 'dumbbell',
    label: '哑铃',
    svg: `
      <rect x="4" y="17" width="6" height="14" rx="1.5"/>
      <rect x="12" y="12" width="5" height="24" rx="1.5"/>
      <rect x="17" y="21" width="14" height="6" rx="1.5"/>
      <rect x="31" y="12" width="5" height="24" rx="1.5"/>
      <rect x="38" y="17" width="6" height="14" rx="1.5"/>
    `,
  },
  {
    key: 'barbell',
    label: '杠铃',
    svg: `
      <line x1="3" y1="24" x2="45" y2="24"/>
      <rect x="8" y="15" width="3.5" height="18" rx="1"/>
      <rect x="13" y="13" width="3.5" height="22" rx="1"/>
      <rect x="18" y="15" width="3.5" height="18" rx="1"/>
      <line x1="23" y1="20" x2="23" y2="28"/>
      <line x1="25" y1="20" x2="25" y2="28"/>
      <rect x="26.5" y="15" width="3.5" height="18" rx="1"/>
      <rect x="31.5" y="13" width="3.5" height="22" rx="1"/>
      <rect x="36.5" y="15" width="3.5" height="18" rx="1"/>
    `,
  },
  {
    key: 'kettlebell',
    label: '壶铃',
    svg: `
      <path d="M16 11 C16 4.5 32 4.5 32 11"/>
      <line x1="16" y1="11" x2="14" y2="20"/>
      <line x1="32" y1="11" x2="34" y2="20"/>
      <circle cx="24" cy="29" r="11"/>
      <line x1="18" y1="40" x2="30" y2="40"/>
    `,
  },
  {
    key: 'rowing',
    label: '划船机',
    svg: `
      <line x1="4" y1="38" x2="44" y2="38"/>
      <circle cx="8" cy="27" r="6"/>
      <circle cx="8" cy="27" r="2"/>
      <path d="M6 38 v-6 h8"/>
      <path d="M12 21 L26 26"/>
      <rect x="26" y="23" width="9" height="5" rx="2"/>
      <rect x="27" y="31" width="8" height="7" rx="1"/>
    `,
  },
  {
    key: 'treadmill',
    label: '跑步机',
    svg: `
      <line x1="4" y1="36" x2="33" y2="36"/>
      <circle cx="7" cy="33.5" r="2.5"/>
      <path d="M33 36 V16"/>
      <rect x="30" y="9" width="13" height="8" rx="1.5"/>
      <line x1="41" y1="17" x2="44" y2="34"/>
    `,
  },
  {
    key: 'yoga-mat',
    label: '瑜伽垫',
    svg: `
      <rect x="4" y="12" width="40" height="24" rx="3"/>
      <line x1="18" y1="14" x2="18" y2="34"/>
      <line x1="30" y1="14" x2="30" y2="34"/>
    `,
  },
  {
    key: 'medicine-ball',
    label: '健身球',
    svg: `
      <circle cx="24" cy="24" r="15"/>
      <line x1="14" y1="24" x2="34" y2="24"/>
      <line x1="24" y1="14" x2="24" y2="34"/>
      <circle cx="24" cy="24" r="4.5"/>
    `,
  },
  {
    key: 'resistance-band',
    label: '弹力带',
    svg: `
      <ellipse cx="24" cy="27" rx="14" ry="11"/>
      <line x1="6" y1="22" x2="1" y2="22"/>
      <line x1="1" y1="19" x2="1" y2="25"/>
      <line x1="42" y1="32" x2="47" y2="32"/>
      <line x1="47" y1="29" x2="47" y2="35"/>
    `,
  },
  {
    key: 'squat-rack',
    label: '杠铃架',
    svg: `
      <line x1="9" y1="8" x2="9" y2="42"/>
      <line x1="39" y1="8" x2="39" y2="42"/>
      <line x1="9" y1="8" x2="39" y2="8"/>
      <line x1="4" y1="42" x2="14" y2="42"/>
      <line x1="34" y1="42" x2="44" y2="42"/>
      <line x1="39" y1="22" x2="33" y2="22"/>
      <line x1="33" y1="22" x2="33" y2="28"/>
      <line x1="12" y1="22" x2="36" y2="22"/>
      <rect x="13" y="18" width="3" height="8" rx="1"/>
      <rect x="32" y="18" width="3" height="8" rx="1"/>
    `,
  },
  {
    key: 'force-plate',
    label: '测力台',
    svg: `
      <rect x="5" y="29" width="38" height="8" rx="2"/>
      <line x1="10" y1="41" x2="14" y2="41"/>
      <line x1="34" y1="41" x2="38" y2="41"/>
      <line x1="24" y1="9" x2="24" y2="22"/>
      <path d="M17 21 L24 29 L31 21"/>
      <line x1="11" y1="26" x2="11" y2="31"/>
      <line x1="37" y1="26" x2="37" y2="31"/>
    `,
  },
  {
    key: 'timing-gate',
    label: '光电门',
    svg: `
      <line x1="10" y1="10" x2="10" y2="40"/>
      <line x1="38" y1="10" x2="38" y2="40"/>
      <line x1="10" y1="10" x2="38" y2="10"/>
      <line x1="5" y1="40" x2="15" y2="40"/>
      <line x1="33" y1="40" x2="43" y2="40"/>
      <path d="M10 27 H38" stroke-dasharray="3 3"/>
      <circle cx="14" cy="15" r="2"/>
    `,
  },
  {
    key: 'cable-machine',
    label: '拉力器',
    svg: `
      <line x1="13" y1="8" x2="13" y2="40"/>
      <line x1="31" y1="8" x2="31" y2="40"/>
      <line x1="13" y1="8" x2="31" y2="8"/>
      <circle cx="22" cy="14" r="3"/>
      <line x1="22" y1="17" x2="22" y2="33"/>
      <rect x="17" y="33" width="10" height="4" rx="2"/>
    `,
  },
  {
    key: 'jump-rope',
    label: '跳绳',
    svg: `
      <path d="M8 18 C12 40 36 40 40 18"/>
      <line x1="3" y1="13" x2="10" y2="17"/>
      <line x1="38" y1="17" x2="45" y2="13"/>
      <circle cx="3.5" cy="12" r="1.5"/>
      <circle cx="44.5" cy="12" r="1.5"/>
    `,
  },
  {
    key: 'foam-roller',
    label: '泡沫轴',
    svg: `
      <rect x="5" y="17" width="38" height="14" rx="7"/>
      <path d="M15 17 a3 3 0 0 1 6 0"/>
      <path d="M22 17 a3 3 0 0 1 6 0"/>
      <path d="M29 17 a3 3 0 0 1 6 0"/>
      <line x1="37" y1="19" x2="37" y2="29"/>
    `,
  },
  {
    key: 'pull-up-bar',
    label: '单杠',
    svg: `
      <line x1="6" y1="12" x2="42" y2="12"/>
      <line x1="10" y1="12" x2="10" y2="40"/>
      <line x1="38" y1="12" x2="38" y2="40"/>
      <line x1="5" y1="40" x2="15" y2="40"/>
      <line x1="33" y1="40" x2="43" y2="40"/>
      <path d="M19 12 l1.5 -3 l1.5 3 l1.5 -3 l1.5 3"/>
    `,
  },
  {
    key: 'stopwatch',
    label: '秒表',
    svg: `
      <circle cx="21" cy="27" r="13"/>
      <rect x="18" y="6" width="6" height="6" rx="1.5"/>
      <line x1="21" y1="12" x2="21" y2="14"/>
      <rect x="31" y="22" width="4" height="7" rx="1"/>
      <rect x="15" y="21" width="12" height="9" rx="1.5"/>
      <line x1="21" y1="27" x2="21" y2="19"/>
      <line x1="21" y1="27" x2="27" y2="27"/>
    `,
  },
  {
    key: 'agility-ladder',
    label: '敏捷梯',
    svg: `
      <rect x="6" y="10" width="36" height="28" rx="2"/>
      <line x1="6" y1="18" x2="42" y2="18"/>
      <line x1="6" y1="26" x2="42" y2="26"/>
    `,
  },
];

/** 按名称快速查找（兼容「药球」等别名） */
export function getEquipmentIcon(label: string): EquipmentIconDef | undefined {
  const aliases: Record<string, string> = { '药球': 'medicine-ball' };
  const key = aliases[label] || label;
  return EQUIPMENT_ICONS.find((e) => e.key === key || e.label === label);
}
