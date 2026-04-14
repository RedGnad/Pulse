import ActPage from "./act/page";

// Pulse's landing is the action router. The old network-wide dashboard
// ("Signal") is archived in src/components/dashboard/dashboard-content.tsx
// and will be folded into /proof as a topology tab in a follow-up.
export default function Home() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <main style={{ position: "relative", zIndex: 10, maxWidth: 1280, margin: "0 auto", width: "100%", flex: 1, padding: "clamp(16px, 4vw, 32px) clamp(12px, 3vw, 28px) 48px" }}>
        <ActPage />
      </main>
      <footer style={{ position: "relative", zIndex: 10, borderTop: "1px solid rgba(0,212,255,0.06)", padding: "16px 28px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 8, letterSpacing: "0.25em", color: "#1E2E38", textTransform: "uppercase" }}>
            Initia Pulse
          </span>
          <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 8, letterSpacing: "0.2em", color: "#1E2E38", textTransform: "uppercase" }}>
            Built for INITIATE Hackathon S1
          </span>
        </div>
      </footer>
    </div>
  );
}
