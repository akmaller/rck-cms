'use client';

import * as React from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";

import { cn } from "@/lib/utils";
import type { VisitTrendPoint } from "@/types/analytics";

type VisitTrendChartProps = {
  data: VisitTrendPoint[];
  className?: string;
};

type TrendTooltipPayload = TooltipProps<number, string>;

const VisitTrendTooltip = ({ active, payload }: TrendTooltipPayload) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0];
  const context = item.payload as VisitTrendPoint | undefined;

  if (!context) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/70 bg-popover/95 px-3 py-2 text-xs shadow-md backdrop-blur">
      <p className="font-medium text-foreground">{context.fullLabel}</p>
      <p className="text-muted-foreground">
        Total: <span className="font-semibold text-foreground">{context.value}</span>
      </p>
    </div>
  );
};

export function VisitTrendChart({ data, className }: VisitTrendChartProps) {
  const hasEntries = React.useMemo(() => data.some((item) => item.value > 0), [data]);
  const paddedMax = React.useMemo(() => {
    const values = data.map((item) => item.value);
    const max = values.length > 0 ? Math.max(...values) : 0;
    if (max === 0) {
      return 5;
    }
    const padding = Math.max(2, Math.ceil(max * 0.15));
    return max + padding;
  }, [data]);

  if (!hasEntries) {
    return (
      <div
        className={cn(
          "flex h-[200px] w-full items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/10 text-sm text-muted-foreground sm:h-[240px]",
          className
        )}
      >
        Data kunjungan belum tersedia.
      </div>
    );
  }

  return (
    <div className={cn("h-[200px] w-full sm:h-[240px]", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 12, bottom: 0, left: 12 }}
        >
          <defs>
            <linearGradient id="visitTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
            opacity={0.5}
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            interval={0}
            fontSize={12}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            domain={[0, paddedMax]}
            allowDecimals={false}
            tickMargin={8}
            width={36}
            fontSize={12}
          />
          <Tooltip
            content={<VisitTrendTooltip />}
            cursor={{ strokeDasharray: "4 4", stroke: "hsl(var(--border))", opacity: 0.6 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="none"
            fill="url(#visitTrendGradient)"
            fillOpacity={1}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={{ r: 3.5, strokeWidth: 2, stroke: "hsl(var(--background))", fill: "hsl(var(--primary))" }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

