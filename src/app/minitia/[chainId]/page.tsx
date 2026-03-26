"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEcosystem } from "@/hooks/use-ecosystem";
import { Header } from "@/components/header";
import { ArrowLeft, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { formatNumber, formatTokenAmount, timeAgo } from "@/lib/format";

interface PageProps {
  params: Promise<{ chainId: string }>;
}

function chainColor(name: string): string {
  const colors = ["#00D4FF","#F0A000","#00B86B","#8B5CF6","#EC4899","#F97316","#06B6D4","#84CC16","#EF4444","#A78BFA"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function SectionBox({ children, title, badge }: { children: React.ReactNode; title: string; badge?: string }) {
  return (
    <div style={{ border: "1px solid rgba(0,212,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid rgba(0,212,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.25em", textTransform: "uppercase", color: "#00D4FF", opacity: 0.7 }}>
          {title}
        </span>
        {badge !== undefined && (
          <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, color: "#4A6880", background: "rgba(0,212,255,0.06)", padding: "2px 8px", borderRadius: 2, border: "1px solid rgba(0,212,255,0.1)" }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ padding: 16 }}>
        {children}
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "10px 14px", border: "1px solid rgba(0,212,255,0.08)", borderRadius: 3, background: "rgba(0,212,255,0.02)" }}>
      <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#4A6880", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 14, fontWeight: 700, color: "#C0D4DC", tabularNums: true } as React.CSSProperties}>{value}</div>
    </div>
  );
}

export default function MinitiaDetailPage({ params }: PageProps) {
  const { chainId: rawChainId } = use(params);
  const chainId = decodeURIComponent(rawChainId);
  const router = useRouter();
  const { data, isLoading, error } = useEcosystem();

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Header />
        <main style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Loader2 style={{ width: 24, height: 24, color: "#00D4FF" }} className="animate-spin" />
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Header />
        <main style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <AlertTriangle style={{ width: 20, height: 20, color: "#F0A000" }} />
          <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 12, color: "#F0A000" }}>Failed to load data.</span>
        </main>
      </div>
    );
  }

  const minitia = data.minitias.find((m) => m.chainId === chainId);

  // Our own rollup — redirect to the dedicated oracle page
  if (chainId === "initia-pulse-1" || minitia?.isOurs) {
    router.replace("/oracle");
    return null;
  }

  if (!minitia) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Header />
        <main style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 12, color: "#8AAABB" }}>
            Chain <code style={{ color: "#E8F0F4" }}>{chainId}</code> not found.
          </span>
          <Link href="/" style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 11, color: "#00D4FF", textDecoration: "none" }}>
            ← Back to overview
          </Link>
        </main>
      </div>
    );
  }

  const color = chainColor(minitia.prettyName);
  const isLive = (minitia.metrics?.blockHeight ?? 0) > 0;
  const ibcChannelsFrom = data.ibcChannels.filter(ch => ch.sourceChainId === chainId || ch.destChainId === chainId);
  const transferChannels = ibcChannelsFrom.filter(ch => ch.portId === "transfer");
  const nftChannels = ibcChannelsFrom.filter(ch => ch.portId === "nft-transfer");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 1024, margin: "0 auto", width: "100%", flex: 1, padding: "24px 24px" }}>

        {/* Back */}
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24, fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#4A6880", textDecoration: "none", letterSpacing: "0.1em" }}>
          <ArrowLeft style={{ width: 12, height: 12 }} />
          Back to overview
        </Link>

        {/* Chain header */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52,
            borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `${color}18`, border: `1px solid ${color}44`,
            fontFamily: "var(--font-chakra), sans-serif", fontSize: 16, fontWeight: 700, color,
          }}>
            {minitia.prettyName.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontFamily: "var(--font-chakra), sans-serif", fontSize: 22, fontWeight: 700, color: "#E8F0F4", margin: 0 }}>
                {minitia.prettyName}
              </h1>
              <span style={{
                fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, padding: "3px 10px", borderRadius: 2,
                background: isLive ? "rgba(0,184,107,0.1)" : "rgba(74,96,128,0.1)",
                color: isLive ? "#00B86B" : "#4A6880",
                border: `1px solid ${isLive ? "rgba(0,184,107,0.2)" : "rgba(74,96,128,0.15)"}`,
                letterSpacing: "0.2em", textTransform: "uppercase",
              }}>
                {isLive ? "Live" : "Offline"}
              </span>
              <span style={{
                fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, padding: "3px 10px", borderRadius: 2,
                background: "rgba(0,212,255,0.06)", color: "#4A6880",
                border: "1px solid rgba(0,212,255,0.1)",
                letterSpacing: "0.15em", textTransform: "uppercase",
              }}>
                {minitia.networkType}
              </span>
            </div>
            <code style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#4A6880" }}>
              {minitia.chainId}
            </code>
          </div>
          {minitia.explorerUrl && (
            <a
              href={minitia.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 3, fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#4A6880", textDecoration: "none" }}
            >
              Explorer <ExternalLink style={{ width: 10, height: 10 }} />
            </a>
          )}
        </div>

        {/* Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 24 }}>
          <MetricBox label="Block Height" value={minitia.metrics?.blockHeight ? formatNumber(minitia.metrics.blockHeight) : "—"} />
          <MetricBox label="Total Txs" value={minitia.metrics?.totalTxCount ? formatNumber(minitia.metrics.totalTxCount) : "—"} />
          <MetricBox label="Avg Block" value={minitia.metrics?.avgBlockTime ? `${minitia.metrics.avgBlockTime.toFixed(2)}s` : "—"} />
          <MetricBox label="Validators" value={minitia.metrics?.activeValidators?.toString() ?? "—"} />
          <MetricBox label="Last Block" value={minitia.metrics?.latestBlockTime ? timeAgo(minitia.metrics.latestBlockTime) : "—"} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* IBC Channels */}
          <SectionBox title="IBC Connections" badge={String(ibcChannelsFrom.length)}>
            {transferChannels.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 8, letterSpacing: "0.2em", color: "#3A5060", textTransform: "uppercase", marginBottom: 8 }}>ICS-20 Token Transfer</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {transferChannels.map(ch => (
                    <div key={ch.channelId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", border: "1px solid rgba(0,212,255,0.06)", borderRadius: 2, background: "rgba(0,212,255,0.02)" }}>
                      <code style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#00D4FF" }}>{ch.channelId}</code>
                      <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, color: "#4A6880" }}>
                        {ch.sourceChainId === chainId ? ch.destChainId : ch.sourceChainId}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {nftChannels.length > 0 && (
              <div>
                <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 8, letterSpacing: "0.2em", color: "#3A5060", textTransform: "uppercase", marginBottom: 8 }}>ICS-721 NFT Transfer</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {nftChannels.map(ch => (
                    <div key={ch.channelId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 2, background: "rgba(139,92,246,0.04)" }}>
                      <code style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#8B5CF6" }}>{ch.channelId}</code>
                      <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, color: "#4A6880" }}>
                        {ch.sourceChainId === chainId ? ch.destChainId : ch.sourceChainId}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {ibcChannelsFrom.length === 0 && (
              <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#3A5060" }}>No IBC channels found.</span>
            )}
          </SectionBox>

          {/* Token Supply */}
          <SectionBox title="Token Supply" badge={`${minitia.metrics?.totalSupply?.length ?? 0} denoms`}>
            {minitia.metrics?.totalSupply && minitia.metrics.totalSupply.length > 0 ? (
              <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {minitia.metrics.totalSupply.map(token => (
                  <div key={token.denom} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", border: "1px solid rgba(0,212,255,0.06)", borderRadius: 2, background: "rgba(0,212,255,0.02)" }}>
                    <code style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, color: "#4A6880", maxWidth: "55%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {token.denom}
                    </code>
                    <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#8AAABB" }}>
                      {formatTokenAmount(token.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#3A5060" }}>No supply data available.</span>
            )}
          </SectionBox>
        </div>

        {/* API Endpoints */}
        <SectionBox title="API Endpoints">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { label: "REST", urls: minitia.apis.rest },
              { label: "RPC", urls: minitia.apis.rpc },
              { label: "API", urls: minitia.apis.api },
            ].map(({ label, urls }) => (
              <div key={label}>
                <div style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 8, letterSpacing: "0.2em", color: "#3A5060", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
                {urls.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {urls.map(url => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "block", padding: "4px 8px", border: "1px solid rgba(0,212,255,0.06)", borderRadius: 2, fontFamily: "var(--font-jetbrains), monospace", fontSize: 9, color: "#4A6880", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontFamily: "var(--font-jetbrains), monospace", fontSize: 10, color: "#3A5060" }}>—</span>
                )}
              </div>
            ))}
          </div>
        </SectionBox>
      </main>
    </div>
  );
}
