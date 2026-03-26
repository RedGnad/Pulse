"use client";

import { useEffect, useRef, useState } from "react";
import { L1Block } from "@/lib/types";

interface BlockTickerProps {
  blocks: L1Block[];
}

function timeAgoShort(ts: string): string {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function BlockTicker({ blocks }: BlockTickerProps) {
  const [displayed, setDisplayed] = useState<L1Block[]>(blocks.slice(0, 15));
  const prevHeightRef = useRef<number>(0);

  useEffect(() => {
    if (!blocks.length) return;
    const newest = blocks[0];
    if (newest.height !== prevHeightRef.current) {
      prevHeightRef.current = newest.height;
      setDisplayed(blocks.slice(0, 15));
    }
  }, [blocks]);

  if (!displayed.length) return null;

  // Duplicate for seamless scroll
  const items = [...displayed, ...displayed];

  return (
    <div style={{
      position: "relative",
      overflow: "hidden",
      borderTop: "1px solid rgba(0,212,255,0.07)",
      borderBottom: "1px solid rgba(0,212,255,0.07)",
      background: "rgba(5,8,13,0.7)",
    }}>
      {/* Fade edges */}
      <div style={{ position: "absolute", inset: 0, left: 0, width: 80, background: "linear-gradient(90deg, #05080D, transparent)", pointerEvents: "none", zIndex: 10 }} />
      <div style={{ position: "absolute", inset: 0, left: "auto", right: 0, width: 80, background: "linear-gradient(270deg, #05080D, transparent)", pointerEvents: "none", zIndex: 10 }} />

      {/* L1 Live label */}
      <div style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 6, zIndex: 20 }}>
        <span style={{ display: "block", width: 5, height: 5, borderRadius: "50%", background: "#00D4FF", boxShadow: "0 0 8px #00D4FF", animation: "pulse-glow 2s infinite" }} />
        <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 8, fontWeight: 600, letterSpacing: "0.3em", color: "#00D4FF", textTransform: "uppercase" }}>L1</span>
      </div>

      {/* Scrolling track */}
      <div style={{ display: "flex", alignItems: "center", padding: "8px 100px 8px 80px", gap: 6, animation: "ticker-scroll 40s linear infinite", width: "max-content" }}>
        {items.map((block, i) => {
          const isNew = i === 0 || i === displayed.length;
          return (
            <div
              key={`${block.hash}-${i}`}
              style={{
                display: "flex",
                flexShrink: 0,
                alignItems: "center",
                gap: 8,
                padding: "5px 12px",
                borderRadius: 2,
                background: isNew ? "rgba(0,212,255,0.07)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${isNew ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.03)"}`,
              }}
            >
              <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, fontWeight: 700, color: isNew ? "#00D4FF" : "#3A5868" }}>
                #{block.height.toLocaleString()}
              </span>
              <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, color: "#7A9AAB", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {block.proposer.moniker}
              </span>
              {block.tx_count > 0 && (
                <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, color: "#F0A000" }}>
                  {block.tx_count}tx
                </span>
              )}
              <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 8, color: "#1E2E38" }}>
                {timeAgoShort(block.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
