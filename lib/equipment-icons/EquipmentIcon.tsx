/**
 * 器材简笔画渲染组件 —— 统一尺寸、继承当前颜色
 */
import { EQUIPMENT_ICONS, getEquipmentIcon } from './registry';

interface EquipmentIconProps {
  /** 器材键名（如 dumbbell）或名称（如 哑铃） */
  icon: string;
  className?: string;
}

export function EquipmentIcon({ icon, className }: EquipmentIconProps) {
  const def = getEquipmentIcon(icon) || EQUIPMENT_ICONS.find((e) => e.key === icon);
  if (!def) return null;
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <g dangerouslySetInnerHTML={{ __html: def.svg }} />
    </svg>
  );
}
