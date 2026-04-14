"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw, Home } from "lucide-react";

const MONO = "var(--font-jetbrains), monospace";
const SANS = "var(--font-chakra), sans-serif";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[Pulse global error]", error);
  }, [error]);

  return (
    <div style={{
      maxWidth: 640, margin: "0 auto", padding: "80px 28px",
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 12,
        border: "1px solid rgba(255,51,102,0.25)",
        background: "rgba(255,51,102,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20,
      }}>
        <AlertTriangle style={{ width: 26, height: 26, color: "#FF3366" }} />
      </div>
      <h1 style={{
        fontFamily: SANS, fontSize: 28, fontWeight: 800, color: "#E0F0FF",
        margin: "0 0 10px", letterSpacing: "-0.01em",
      }}>
        Something broke on this page
      </h1>
      <p style={{ fontFamily: MONO, fontSize: 13, color: "#8AB4C8", margin: "0 0 6px", lineHeight: 1.6 }}>
        Pulse caught an unexpected error. The signal layer is still running — you can retry or head back to the home page.
      </p>
      {error.digest && (
        <p style={{ fontFamily: MONO, fontSize: 10, color: "#3A5A6A", margin: "0 0 24px" }}>
          ref: {error.digest}
        </p>
      )}
      {!error.digest && <div style={{ height: 24 }} />}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={reset}
          style={{
            padding: "11px 18px", borderRadius: 7,
            border: "1px solid rgba(0,255,136,0.3)",
            background: "rgba(0,255,136,0.06)",
            color: "#00FF88", fontFamily: MONO, fontSize: 12, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <RotateCw style={{ width: 13, height: 13 }} />
          Retry
        </button>
        <Link href="/" style={{ textDecoration: "none" }}>
          <div style={{
            padding: "11px 18px", borderRadius: 7,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(10,18,24,0.6)",
            color: "#8AB4C8", fontFamily: MONO, fontSize: 12, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Home style={{ width: 13, height: 13 }} />
            Back to Act
          </div>
        </Link>
      </div>
    </div>
  );
}
