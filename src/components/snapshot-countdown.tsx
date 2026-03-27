"use client";

import { useEffect, useState } from "react";

const INTERVAL_S = 5 * 60; // 5 minutes

/**
 * Displays a live countdown to the next oracle snapshot.
 * `latestTimestamp` is the epoch (seconds) of the last snapshot.
 * Cycles every 5 min — if the last snapshot is old, calculates
 * position within the current 5-min window.
 */
export function SnapshotCountdown({
  latestTimestamp,
  fontSize = 11,
  color = "#5A7A8A",
  mono = true,
}: {
  latestTimestamp?: number | null;
  fontSize?: number;
  color?: string;
  mono?: boolean;
}) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Remaining seconds until next 5-min mark from the last snapshot.
  // If the snapshot is old, we modulo into the current cycle so the
  // timer always shows a meaningful countdown.
  let remaining: number;

  if (latestTimestamp && latestTimestamp > 0) {
    const elapsed = now - latestTimestamp;
    remaining = INTERVAL_S - (elapsed % INTERVAL_S);
    // When exactly 0, show full cycle
    if (remaining === INTERVAL_S) remaining = 0;
  } else {
    // No data — show a cycle based on wall clock
    remaining = INTERVAL_S - (now % INTERVAL_S);
  }

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const label = `Next snapshot in ${m}:${s.toString().padStart(2, "0")}`;

  return (
    <span
      style={{
        fontFamily: mono
          ? "var(--font-jetbrains), monospace"
          : "var(--font-chakra), sans-serif",
        fontSize,
        color,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {label}
    </span>
  );
}
