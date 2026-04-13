import Link from "next/link";
import { Compass, Home } from "lucide-react";

const MONO = "var(--font-jetbrains), monospace";
const SANS = "var(--font-chakra), sans-serif";

export default function NotFound() {
  return (
    <div style={{
      maxWidth: 640, margin: "0 auto", padding: "80px 28px",
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 12,
        border: "1px solid rgba(0,212,255,0.25)",
        background: "rgba(0,212,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20,
      }}>
        <Compass style={{ width: 26, height: 26, color: "#00D4FF" }} />
      </div>
      <h1 style={{
        fontFamily: SANS, fontSize: 28, fontWeight: 800, color: "#E0F0FF",
        margin: "0 0 10px", letterSpacing: "-0.01em",
      }}>
        Off the map
      </h1>
      <p style={{ fontFamily: MONO, fontSize: 13, color: "#8AB4C8", margin: "0 0 28px", lineHeight: 1.6 }}>
        That route doesn&apos;t exist. Head back to Signal or try Ask Pulse.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <div style={{
            padding: "11px 18px", borderRadius: 7,
            border: "1px solid rgba(0,255,136,0.3)",
            background: "rgba(0,255,136,0.06)",
            color: "#00FF88", fontFamily: MONO, fontSize: 12, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Home style={{ width: 13, height: 13 }} />
            Signal
          </div>
        </Link>
        <Link href="/ask" style={{ textDecoration: "none" }}>
          <div style={{
            padding: "11px 18px", borderRadius: 7,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(10,18,24,0.6)",
            color: "#8AB4C8", fontFamily: MONO, fontSize: 12, fontWeight: 600,
          }}>
            Ask Pulse
          </div>
        </Link>
      </div>
    </div>
  );
}
