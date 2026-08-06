'use client';

/** 近 28 天每日训练量柱状图（SVG，自适应宽度） */
export function LoadBarChart({ loads }: { loads: number[] }) {
  const max = Math.max(...loads, 1);
  const count = loads.length;
  const width = 280;
  const height = 52;
  const gap = 2;
  const barW = (width - gap * (count - 1)) / count;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      {loads.map((v, i) => {
        const h = max > 0 ? (v / max) * height : 0;
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            rx={1}
            className={v > 0 ? 'fill-ams-primary' : 'fill-ams-border'}
          />
        );
      })}
    </svg>
  );
}
