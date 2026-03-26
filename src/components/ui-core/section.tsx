interface SectionProps {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  sysId?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Section({ label, children, action, sysId, className = "", style }: SectionProps) {
  return (
    <div className={className} style={style}>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16, gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontFamily: "var(--font-chakra), sans-serif",
            fontSize: 16, fontWeight: 600,
            color: "#8AB4C8",
            letterSpacing: "-0.01em",
          }}>
            {label}
          </span>
          {sysId && (
            <span style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 9, letterSpacing: "0.15em",
              color: "#0D1A24",
              background: "rgba(0,255,136,0.03)",
              padding: "2px 6px", borderRadius: 2,
              border: "1px solid rgba(0,255,136,0.06)",
            }}>
              {sysId}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
