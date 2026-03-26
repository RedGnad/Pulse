"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { MinitiaWithMetrics } from "@/lib/types";
import { formatNumber } from "@/lib/format";

interface EcosystemChartProps {
  minitias: MinitiaWithMetrics[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: "#080C12", border: "1px solid rgba(0,212,255,0.15)",
      borderRadius: 3, padding: "8px 12px",
    }}>
      <p style={{ fontFamily: "var(--font-chakra), sans-serif", fontSize: 12, color: "#EEF4F8", marginBottom: 4 }}>{d.name}</p>
      <p style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#4A6880" }}>
        Total txs: <span style={{ color: "#00B86B" }}>{formatNumber(d.txCount)}</span>
      </p>
      <p style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#4A6880" }}>
        Block: <span style={{ color: "#00D4FF" }}>{formatNumber(d.blockHeight)}</span>
      </p>
    </div>
  );
}

function chainColor(name: string): string {
  const colors = ["#00D4FF", "#F0A000", "#00B86B", "#8B5CF6", "#EC4899", "#F97316", "#06B6D4", "#84CC16", "#A78BFA", "#14B8A6", "#F59E0B", "#6366F1", "#EF4444"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

export function EcosystemChart({ minitias }: EcosystemChartProps) {
  const data = minitias
    .filter((m) => (m.metrics?.totalTxCount ?? 0) > 0)
    .map((m) => ({
      name: m.prettyName,
      txCount: m.metrics!.totalTxCount,
      blockHeight: m.metrics!.blockHeight,
      color: chainColor(m.prettyName),
    }))
    .sort((a, b) => b.txCount - a.txCount);

  if (data.length === 0) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
          <XAxis
            type="number"
            tickFormatter={(v) => formatNumber(v)}
            tick={{ fontSize: 9, fill: "#3A5868", fontFamily: "var(--font-jetbrains), monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={68}
            tick={{ fontSize: 10, fill: "#7A9AAB", fontFamily: "var(--font-jetbrains), monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,212,255,0.03)" }} />
          <Bar dataKey="txCount" radius={[0, 2, 2, 0]} maxBarSize={14}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color + "99"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
