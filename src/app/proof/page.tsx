"use client";

// /proof — the single place to verify that the Pulse signal is real.
//
// The router on / makes a decision. /proof is where you confirm that
// decision is backed by on-chain data and a gate contract anyone can read.
//
// This page deliberately does NOT duplicate the logic in /oracle or /gate;
// it just mounts the existing components inside a tab shell. Both routes
// stay alive as deep-links for people who bookmark them, but the header
// nav now points here.

import { useState } from "react";
import Link from "next/link";
import { Database, ShieldCheck, ExternalLink } from "lucide-react";
import OraclePage from "../oracle/page";
import GatePage from "../gate/page";

const MONO = "var(--font-jetbrains), monospace";
const SANS = "var(--font-chakra), sans-serif";

type Tab = "oracle" | "gate";

const TABS: { id: Tab; label: string; sub: string; Icon: typeof Database; deepLink: string }[] = [
  { id: "oracle", label: "On-chain signal",       sub: "Pulse Oracle snapshots — the number contracts read.",   Icon: Database,    deepLink: "/oracle" },
  { id: "gate",   label: "30 lines of Solidity",  sub: "The reference gate contract any rollup can deploy.",    Icon: ShieldCheck, deepLink: "/gate"   },
];

export default function ProofPage() {
  const [tab, setTab] = useState<Tab>("oracle");

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 28px 20px" }}>
      <section style={{ marginBottom: 24 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#A78BFA", padding: "5px 12px", borderRadius: 4,
          background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)",
          marginBottom: 14,
        }}>
          Proof layer
        </div>
        <h1 style={{
          fontFamily: SANS, fontSize: 34, fontWeight: 800, color: "#E0F0FF",
          margin: "0 0 10px", letterSpacing: "-0.02em", lineHeight: 1.1,
        }}>
          The same signal the router just used.
        </h1>
        <p style={{ fontFamily: MONO, fontSize: 12, color: "#8AB4C8", margin: 0, lineHeight: 1.6, maxWidth: 680 }}>
          Everything Pulse decides is backed by public data. Read the
          on-chain oracle, read the gate contract, read the live topology —
          or click through to the standalone pages for deep-linking.
        </p>
      </section>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 6,
        marginBottom: 20,
        padding: 4,
        borderRadius: 8,
        border: "1px solid rgba(167,139,250,0.12)",
        background: "rgba(10,18,24,0.6)",
      }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 5,
                border: "none",
                background: active ? "rgba(167,139,250,0.08)" : "transparent",
                color: active ? "#E0F0FF" : "#8AB4C8",
                cursor: "pointer",
                fontFamily: SANS, fontSize: 13, fontWeight: 700,
                textAlign: "left",
                display: "flex", alignItems: "center", gap: 10,
                transition: "all 0.15s",
              }}
            >
              <t.Icon style={{
                width: 14, height: 14,
                color: active ? "#A78BFA" : "#5A7A8A",
                flexShrink: 0,
              }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block" }}>{t.label}</span>
                <span style={{
                  display: "block",
                  fontFamily: MONO, fontSize: 10, fontWeight: 400,
                  color: "#5A7A8A", marginTop: 2,
                }}>
                  {t.sub}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Deep-link hint — each tab has a standalone route with extra controls. */}
      <div style={{
        marginBottom: 12,
        fontFamily: MONO, fontSize: 10,
        color: "#5A7A8A",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span>deep-link:</span>
        <Link href={TABS.find(t => t.id === tab)!.deepLink} style={{
          color: "#A78BFA", textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          {TABS.find(t => t.id === tab)!.deepLink}
          <ExternalLink style={{ width: 10, height: 10 }} />
        </Link>
      </div>

      {/* Active tab content. Only one mounts at a time — /oracle and /gate
          are heavy client components with their own polling intervals, so
          we want them torn down when the user switches tabs. */}
      <div>
        {tab === "oracle" && <OraclePage />}
        {tab === "gate" && <GatePage />}
      </div>
    </div>
  );
}
