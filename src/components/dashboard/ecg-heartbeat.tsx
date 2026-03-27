"use client";

import { useRef, useEffect, useMemo } from "react";
import { L1Block } from "@/lib/types";
import { useNetwork } from "@/contexts/network-context";

const MONO = "var(--font-jetbrains), monospace";

/* ─── ECG waveform shape (PQRST complex) ─────────────────────────────────── */
function ecgWave(t: number, amplitude: number): number {
  // t in [0, 1] — one full heartbeat cycle
  // Returns y offset (negative = up on screen)
  const a = amplitude;

  // P wave (small bump)
  if (t < 0.1) return -a * 0.12 * Math.sin(t / 0.1 * Math.PI);
  // flat
  if (t < 0.18) return 0;
  // Q dip
  if (t < 0.22) {
    const p = (t - 0.18) / 0.04;
    return a * 0.15 * Math.sin(p * Math.PI);
  }
  // R spike (the big one)
  if (t < 0.30) {
    const p = (t - 0.22) / 0.08;
    return -a * Math.sin(p * Math.PI);
  }
  // S dip
  if (t < 0.36) {
    const p = (t - 0.30) / 0.06;
    return a * 0.25 * Math.sin(p * Math.PI);
  }
  // flat
  if (t < 0.45) return 0;
  // T wave (medium bump)
  if (t < 0.6) {
    const p = (t - 0.45) / 0.15;
    return -a * 0.2 * Math.sin(p * Math.PI);
  }
  // flat until next beat
  return 0;
}

/* ─── Props ───────────────────────────────────────────────────────────────── */
interface EcgHeartbeatProps {
  recentBlocks: L1Block[];
  height?: number;
}

export function EcgHeartbeat({ recentBlocks, height = 120 }: EcgHeartbeatProps) {
  const { isMainnet } = useNetwork();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const offsetRef = useRef(0);

  // Compute vital signs from real block data
  const vitals = useMemo(() => {
    if (!recentBlocks.length) return { bpm: 0, avgTx: 0, latestHeight: 0, latestTx: 0 };

    const sorted = [...recentBlocks].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate blocks per minute from timestamps
    let bpm = 0;
    if (sorted.length >= 2) {
      const first = new Date(sorted[0].timestamp).getTime();
      const last = new Date(sorted[sorted.length - 1].timestamp).getTime();
      const spanMinutes = (last - first) / 60000;
      if (spanMinutes > 0) bpm = Math.round((sorted.length - 1) / spanMinutes);
    }

    const avgTx = Math.round(sorted.reduce((s, b) => s + b.tx_count, 0) / sorted.length);
    const latest = sorted[sorted.length - 1];

    return {
      bpm,
      avgTx,
      latestHeight: latest?.height ?? 0,
      latestTx: latest?.tx_count ?? 0,
    };
  }, [recentBlocks]);

  // Build amplitude array from blocks (tx_count normalized)
  const amplitudes = useMemo(() => {
    if (!recentBlocks.length) return [0.3, 0.5, 0.4, 0.6, 0.3, 0.5];
    const sorted = [...recentBlocks].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const maxTx = Math.max(...sorted.map(b => b.tx_count), 1);
    return sorted.map(b => 0.2 + (b.tx_count / maxTx) * 0.8);
  }, [recentBlocks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    function resize() {
      if (!canvas || !container || !ctx) return;
      const w = container.clientWidth;
      const h = height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    // Animation speed: pixels per frame
    const SPEED = 1.2;
    // Width of one heartbeat cycle in pixels
    const BEAT_WIDTH = 160;

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width / dpr;
      const h = height;
      const cy = h * 0.5;
      const maxAmp = h * 0.35;

      ctx.clearRect(0, 0, w, h);

      // Grid lines (subtle medical monitor feel)
      ctx.strokeStyle = "rgba(0,255,136,0.03)";
      ctx.lineWidth = 0.5;
      const gridSize = 20;
      for (let x = -offsetRef.current % gridSize; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Center baseline
      ctx.strokeStyle = "rgba(0,255,136,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(w, cy);
      ctx.stroke();

      // ECG trace
      ctx.beginPath();
      ctx.strokeStyle = "#00FF88";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#00FF88";
      ctx.shadowBlur = 8;

      const totalBeats = amplitudes.length;
      const totalWidth = totalBeats * BEAT_WIDTH;

      for (let px = 0; px < w; px++) {
        // Position in the scrolling waveform
        const pos = (px + offsetRef.current) % totalWidth;
        // Which beat are we in?
        const beatIndex = Math.floor(pos / BEAT_WIDTH) % totalBeats;
        // Position within the beat [0, 1]
        const t = (pos % BEAT_WIDTH) / BEAT_WIDTH;
        const amp = amplitudes[beatIndex] * maxAmp;
        const y = cy + ecgWave(t, amp);

        if (px === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Glow trail on the leading edge (right side)
      const glowWidth = 80;
      const gradient = ctx.createLinearGradient(w - glowWidth, 0, w, 0);
      gradient.addColorStop(0, "transparent");
      gradient.addColorStop(1, "rgba(0,255,136,0.15)");
      ctx.fillStyle = gradient;
      ctx.fillRect(w - glowWidth, 0, glowWidth, h);

      // Scanning line at right edge
      ctx.fillStyle = "rgba(0,255,136,0.4)";
      ctx.fillRect(w - 2, 0, 2, h);

      offsetRef.current += SPEED;
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [amplitudes, height]);

  return (
    <div style={{ position: "relative" }}>
      {/* ECG Canvas */}
      <div ref={containerRef} style={{
        position: "relative",
        height,
        borderRadius: 4,
        overflow: "hidden",
        background: "rgba(4,10,15,0.6)",
        border: "1px solid rgba(0,255,136,0.06)",
      }}>
        <canvas ref={canvasRef} style={{ display: "block" }} />

        {/* Vital signs overlay — top left */}
        <div style={{
          position: "absolute", top: 10, left: 14,
          display: "flex", flexDirection: "column", gap: 3,
          pointerEvents: "none",
        }}>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.15em", color: "#00FF88", textTransform: "uppercase" }}>
            L1 Block Production
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{
              fontFamily: MONO, fontSize: 28, fontWeight: 700, color: "#00FF88",
              lineHeight: 1, fontVariantNumeric: "tabular-nums",
              textShadow: "0 0 20px rgba(0,255,136,0.4)",
            }}>
              {vitals.bpm || "—"}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: "#5A7A8A" }}>
              blocks / min
            </span>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "#3A5A6A", lineHeight: 1.4 }}>
            Each spike = 1 block · Height = tx volume
          </span>
        </div>

        {/* Vital signs — top right */}
        <div style={{
          position: "absolute", top: 10, right: 14,
          display: "flex", gap: 18,
          pointerEvents: "none",
        }}>
          <VitalReadout label="Latest Block" value={vitals.latestHeight != null && vitals.latestHeight > 0 ? vitals.latestHeight.toLocaleString() : "—"} color="#00D4FF" />
          <VitalReadout label="Avg Tx / Block" value={vitals.avgTx != null ? String(vitals.avgTx) : "—"} color="#FFB800" hint={vitals.avgTx === 0 && !isMainnet ? "testnet" : undefined} />
          <VitalReadout label="Last Block Txs" value={vitals.latestTx != null ? String(vitals.latestTx) : "—"} color="#A78BFA" hint={vitals.latestTx === 0 && !isMainnet ? "testnet" : undefined} />
        </div>

        {/* Bottom status bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "5px 14px",
          background: "rgba(0,255,136,0.02)",
          borderTop: "1px solid rgba(0,255,136,0.04)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          pointerEvents: "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#00FF88",
              boxShadow: "0 0 6px #00FF88",
              animation: "pulse-signal 2s infinite",
            }} />
            <span style={{ fontFamily: MONO, fontSize: 11, color: "#5A7A8A", letterSpacing: "0.1em" }}>
              Live · Initia L1 {isMainnet ? "Mainnet" : "Testnet"}
            </span>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "#3A5A6A", letterSpacing: "0.1em" }}>
            {recentBlocks.length} recent blocks sampled
          </span>
        </div>
      </div>
    </div>
  );
}

function VitalReadout({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: `${color}90`, textTransform: "uppercase" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{
          fontFamily: MONO, fontSize: 16, fontWeight: 700, color,
          lineHeight: 1, fontVariantNumeric: "tabular-nums",
          textShadow: `0 0 12px ${color}40`,
        }}>
          {value}
        </span>
        {hint && (
          <span style={{ fontFamily: MONO, fontSize: 9, color: "#3A5A6A", letterSpacing: "0.05em" }}>
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}
