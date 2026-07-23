import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardStat } from "@/types";

export function StatCard({ label, value, delta, trend }: DashboardStat) {
  return (
    <div className="border border-border bg-luxe-white p-5">
      <p className="text-xs font-medium tracking-[0.05em] text-luxe-gray-dark uppercase">{label}</p>
      <p className="font-heading mt-2 text-3xl">{value}</p>
      {typeof delta === "number" ? (
        <div
          className={cn(
            "mt-2 flex items-center gap-1 text-xs font-medium",
            trend === "down" ? "text-destructive" : "text-green-700"
          )}
        >
          {trend === "down" ? (
            <TrendingDown className="size-3.5" strokeWidth={1.5} />
          ) : (
            <TrendingUp className="size-3.5" strokeWidth={1.5} />
          )}
          {Math.abs(delta)}%
          <span className="font-normal text-luxe-gray-dark">vs last period</span>
        </div>
      ) : null}
    </div>
  );
}
