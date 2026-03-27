"use client";

import { useEffect, useState } from "react";

const INTERVAL_S = 5 * 60; // 5 minutes

/**
 * Displays a live countdown to the next oracle snapshot.
 * `latestTimestamp` is the epoch (seconds) of the last snapshot.
 * Falls back to "Next snapshot in ~5 min" when no data is available.
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

  let label: string;

  if (latestTimestamp && latestTimestamp > 0) {
    const elapsed = now - latestTimestamp;
    const remaining = Math.max(0, INTERVAL_S - elapsed);

    if (remaining <= 0) {
      label = "Snapshot imminent…";
    } else {
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      label = `Next snapshot in ${m}:${s.toString().padStart(2, "0")}`;
    }
  } else {
    label = "Next snapshot in ~5 min";
  }

  return (
    <span
      style={{
        fontFamily: mono
          ? "var(--font-jetbrains), monospace"
          : "var(--font-chakra), sans-serif",
        fontSize,
        color,
      }}
    >
      {label}
    </span>
  );
}
