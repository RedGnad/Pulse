import { type LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  accent?: "cyan" | "amber" | "green" | "red";
  sysId?: string;
  className?: string;
}

const ACCENT = {
  cyan:  "#00D4FF",
  amber: "#FFB800",
  green: "#00FF88",
  red:   "#FF3366",
};

export function MetricCard({ label, value, sub, icon: Icon, accent = "cyan", sysId }: MetricCardProps) {
  const color = ACCENT[accent];

  return (
    <div style={{
      padding: "18px 20px 16px",
      background: "rgba(10,18,24,0.7)",
      border: "1px solid rgba(0,255,136,0.06)",
      borderLeft: `3px solid ${color}`,
      borderRadius: 4,
      position: "relative", overflow: "hidden",
    }}>
      {/* Accent wash */}
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0, width: 80,
        background: `linear-gradient(90deg, ${color}07, transparent)`,
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            {sysId && (
              <span style={{
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: 9, letterSpacing: "0.15em",
                color: `${color}40`,
              }}>{sysId}</span>
            )}
            <span style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "#3A5A6A",
            }}>
              {label}
            </span>
          </div>

          <div style={{
            fontFamily: "var(--font-chakra), sans-serif",
            fontSize: 36, fontWeight: 800,
            color: "#E0F0FF",
            lineHeight: 1, letterSpacing: "-0.03em",
          }}>
            {value}
          </div>

          {sub && (
            <div style={{
              marginTop: 8,
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 10, color: "#1E3040",
              letterSpacing: "0.05em",
            }}>
              {sub}
            </div>
          )}
        </div>

        {Icon && (
          <Icon style={{ width: 18, height: 18, color: `${color}35`, flexShrink: 0, marginTop: 2 }} />
        )}
      </div>
    </div>
  );
}
