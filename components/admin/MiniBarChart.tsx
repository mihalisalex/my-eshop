interface MiniBarChartProps {
  data: { label: string; value: number }[];
  formatValue?: (value: number) => string;
}

export function MiniBarChart({ data, formatValue = (v) => String(v) }: MiniBarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        // Index, not item.label: labels are day-granularity ("July 22") but each bar is
        // one order, so multiple same-day orders previously collided on the same key.
        <div key={index} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-luxe-gray-dark">{item.label}</span>
          <div className="h-5 flex-1 bg-luxe-gray-light">
            <div className="h-full bg-luxe-black" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <span className="w-20 shrink-0 text-right text-xs">{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  );
}
