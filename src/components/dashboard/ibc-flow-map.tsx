"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { IbcChannel, MinitiaWithMetrics } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { scoreColor } from "@/lib/pulse-score";

/* ─── Props ───────────────────────────────────────────────────────────────── */

interface IbcFlowMapProps {
  ibcChannels: IbcChannel[];
  minitias: MinitiaWithMetrics[];
  onSelect?: (chainId: string) => void;
  selectedChain?: string | null;
  height?: number;
}

/* ─── Color helper (exported — used by ChainPanel) ────────────────────────── */

export function chainColor(name: string): string {
  const palette = ["#00FF88","#00D4FF","#A78BFA","#FF3366","#FFB800","#22D3EE","#A3E635","#F472B6","#818CF8","#14B8A6","#60A5FA","#FB923C"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

/* ─── Constants ───────────────────────────────────────────────────────────── */

const MONO = "var(--font-jetbrains), monospace";
const SANS = "var(--font-chakra), sans-serif";

/* ─── Bezier path builder ─────────────────────────────────────────────────── */

function bezierPath(x1: number, y1: number, x2: number, y2: number, curvature = 0.2): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cpx = mx + dy * curvature;
  const cpy = my - dx * curvature;
  return `M ${x1},${y1} Q ${cpx},${cpy} ${x2},${y2}`;
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function IbcFlowMap({ ibcChannels, minitias, onSelect, selectedChain, height = 480 }: IbcFlowMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth || 900);
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const transferChannels = ibcChannels.filter(ch => ch.portId === "transfer");
  const chainIds = [...new Set(transferChannels.map(ch => ch.destChainId))];

  // Include our rollup and mainnet refs even without IBC channels
  const ownChain = minitias.filter(m => m.isOurs && !chainIds.includes(m.chainId));
  const mainnetRefs = minitias.filter(m => m.isMainnetRef && !chainIds.includes(m.chainId));
  const allChainIds = [...chainIds, ...ownChain.map(m => m.chainId), ...mainnetRefs.map(m => m.chainId)];

  const nodes = useMemo(() => {
    return allChainIds.map(id => {
      const m = minitias.find(m => m.chainId === id);
      const name = m?.prettyName ?? id.split("-")[0];
      const isLive = (m?.metrics?.blockHeight ?? 0) > 0;
      const isOurs = m?.isOurs ?? id === "initia-pulse-1";
      const isMainnetRef = m?.isMainnetRef ?? false;
      // External IBC peer = in IBC channels but not in our minitia list
      const isExternalPeer = !m && !isOurs;
      const channelCount = transferChannels.filter(
        c => c.sourceChainId === id || c.destChainId === id
      ).length;
      return {
        id, name,
        color: isExternalPeer ? "#6A8A9A" : isMainnetRef ? "#4A6A7A" : isOurs ? "#00FF88" : chainColor(name),
        isLive: isExternalPeer ? true : isMainnetRef ? false : (isLive || isOurs),
        isOurs,
        isMainnetRef,
        isExternalPeer,
        txCount: m?.metrics?.totalTxCount ?? 0,
        blockHeight: m?.metrics?.blockHeight ?? 0,
        blockTime: m?.metrics?.avgBlockTime ?? null,
        channelCount,
        pulseScore: m?.pulseScore?.total ?? null,
      };
    }).sort((a, b) => {
      if (a.isOurs !== b.isOurs) return a.isOurs ? -1 : 1;
      // Live minitias first, then external IBC peers, then dormant, then mainnet refs last
      if (a.isMainnetRef !== b.isMainnetRef) return a.isMainnetRef ? 1 : -1;
      if (a.isExternalPeer !== b.isExternalPeer) return a.isExternalPeer ? 1 : -1;
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
      return b.txCount - a.txCount;
    });
  }, [allChainIds.join(","), minitias, transferChannels.length]);

  const W = containerWidth;
  const H = height;
  const cx = W / 2;
  const cy = H / 2;
  const ringR = Math.min(W * 0.38, H * 0.38);
  const n = nodes.length;
  const maxTx = Math.max(...nodes.map(nd => nd.txCount), 1);

  const activeNodeId = hoveredNode || selectedChain;

  const nodePositions = useMemo(() => {
    return nodes.map((node, i) => {
      const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const x = cx + ringR * Math.cos(angle);
      const y = cy + ringR * Math.sin(angle);
      const activityRatio = node.txCount / maxTx;
      const r = node.isOurs ? 22 : node.isLive ? (14 + activityRatio * 10) : 12;
      return { ...node, x, y, r, angle };
    });
  }, [nodes, cx, cy, ringR, n, maxTx]);

  const connections = useMemo(() => {
    return nodePositions.map(node => {
      const path = bezierPath(cx, cy, node.x, node.y, 0.15);
      return { nodeId: node.id, path, color: node.color, isLive: node.isLive, channelCount: node.channelCount };
    });
  }, [nodePositions, cx, cy]);

  const liveCount = nodes.filter(nd => nd.isLive).length;

  if (!transferChannels.length) {
    return (
      <div ref={containerRef} style={{ height, display: "flex", alignItems: "center", justifyContent: "center", background: "#040A0F" }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "#1E3040" }}>No IBC channel data</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative", height, background: "#040A0F", overflow: "hidden" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <defs>
          <radialGradient id="map-bg" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(0,255,136,0.02)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x={0} y={0} width={W} height={H} fill="url(#map-bg)" />

        {/* Orbital ring guide */}
        <circle cx={cx} cy={cy} r={ringR}
          fill="none" stroke="rgba(0,255,136,0.03)" strokeWidth={1}
        />

        {/* Radial pulse from L1 center */}
        {[0, 1, 2].map(i => (
          <circle key={`pulse-${i}`} cx={cx} cy={cy} fill="none"
            stroke="rgba(0,255,136,0.08)" strokeWidth={0.8}
          >
            <animate attributeName="r" from="30" to={ringR * 0.7} dur="5s" begin={`${i * 1.67}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.12" to="0" dur="5s" begin={`${i * 1.67}s`} repeatCount="indefinite" />
          </circle>
        ))}

        {/* Connection lines (curved bezier) */}
        {connections.map((conn, ci) => {
          const isActive = conn.nodeId === activeNodeId;
          const isFocused = activeNodeId !== null;
          const opacity = isActive ? 0.5
            : isFocused ? 0.05
            : conn.isLive ? 0.12 : 0.08;
          const strokeW = isActive ? 2 : conn.isLive ? (0.8 + conn.channelCount * 0.3) : 0.5;

          return (
            <path key={`conn-${conn.nodeId}-${n}`}
              d={conn.path}
              fill="none"
              stroke={conn.color}
              strokeWidth={Math.min(strokeW, 3)}
              strokeOpacity={opacity}
              strokeDasharray={conn.isLive ? "none" : "4 8"}
              style={{
                transition: "stroke-opacity 0.3s, stroke-width 0.3s",
                animation: `ibc-node-enter 0.6s ease-out ${ci * 0.08}s both`,
              }}
            />
          );
        })}

        {/* Animated flow particles — fast + low cadence via keyPoints */}
        {/* Particles wait for their connection line to finish entering (ci * 0.08 + 0.6s) */}
        {connections.filter(c => c.isLive).map((conn, i) => {
          const ci = connections.indexOf(conn); // original index in full connections array
          const lineEnteredAt = ci * 0.08 + 0.6; // time when this connection line is fully visible
          const isActive = conn.nodeId === activeNodeId;
          const isFocused = activeNodeId !== null;
          const groupOpacity = isActive ? 0.85 : isFocused ? 0.04 : 0.55;
          const particleCount = isActive ? 2 : 1;
          return Array.from({ length: particleCount }, (_, pi) => {
            const dur = 1.8 + (i * 0.12) + (pi * 0.25);
            const size = isActive ? 3 : 2.2;
            const delay = lineEnteredAt + pi * (dur / particleCount) + i * 0.3;
            return (
              <g key={`particle-${conn.nodeId}-${pi}`}
                style={{ transition: "opacity 0.3s" }}
              >
                {/* Comet trail — single elongated ellipse, auto-rotates along curve */}
                <ellipse
                  rx={size * 6} ry={size * 0.7}
                  fill={conn.color}
                  opacity={0}
                >
                  <animateMotion
                    dur={`${dur}s`} begin={`${delay}s`}
                    repeatCount="indefinite" path={conn.path}
                    keyPoints="0;1;1" keyTimes="0;0.2;1" calcMode="linear"
                    rotate="auto"
                  />
                  <animate attributeName="opacity"
                    values={`0;${groupOpacity * 0.25};${groupOpacity * 0.25};0;0`}
                    keyTimes="0;0.01;0.18;0.21;1"
                    dur={`${dur}s`} begin={`${delay}s`}
                    repeatCount="indefinite"
                  />
                </ellipse>
                {/* Glow halo — soft circle around head */}
                <circle
                  r={size * 2.2}
                  fill={conn.color}
                  opacity={0}
                >
                  <animateMotion
                    dur={`${dur}s`} begin={`${delay}s`}
                    repeatCount="indefinite" path={conn.path}
                    keyPoints="0;1;1" keyTimes="0;0.2;1" calcMode="linear"
                  />
                  <animate attributeName="opacity"
                    values={`0;${groupOpacity * 0.15};${groupOpacity * 0.15};0;0`}
                    keyTimes="0;0.01;0.18;0.21;1"
                    dur={`${dur}s`} begin={`${delay}s`}
                    repeatCount="indefinite"
                  />
                </circle>
                {/* Coloured body */}
                <circle
                  r={size}
                  fill={conn.color}
                >
                  <animateMotion
                    dur={`${dur}s`} begin={`${delay}s`}
                    repeatCount="indefinite" path={conn.path}
                    keyPoints="0;1;1" keyTimes="0;0.2;1" calcMode="linear"
                  />
                  <animate attributeName="opacity"
                    values={`0;${groupOpacity * 0.75};${groupOpacity * 0.75};0;0`}
                    keyTimes="0;0.01;0.18;0.21;1"
                    dur={`${dur}s`} begin={`${delay}s`}
                    repeatCount="indefinite"
                  />
                </circle>
                {/* White core */}
                <circle
                  r={size * 0.4}
                  fill="white"
                >
                  <animateMotion
                    dur={`${dur}s`} begin={`${delay}s`}
                    repeatCount="indefinite" path={conn.path}
                    keyPoints="0;1;1" keyTimes="0;0.2;1" calcMode="linear"
                  />
                  <animate attributeName="opacity"
                    values={`0;${groupOpacity * 0.9};${groupOpacity * 0.9};0;0`}
                    keyTimes="0;0.01;0.18;0.21;1"
                    dur={`${dur}s`} begin={`${delay}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            );
          });
        })}

        {/* L1 Center node */}
        <g>
          <circle cx={cx} cy={cy} r={36}
            fill="rgba(0,255,136,0.03)"
            stroke="rgba(0,255,136,0.12)" strokeWidth={1}
          />
          <circle cx={cx} cy={cy} r={24}
            fill="rgba(0,255,136,0.06)"
            stroke="rgba(0,255,136,0.3)" strokeWidth={1.5}
          />
          <text x={cx} y={cy - 3} textAnchor="middle" dominantBaseline="middle"
            fill="#00FF88" fontSize={12} fontWeight={700} fontFamily={SANS}>
            INITIA
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle"
            fill="rgba(0,255,136,0.35)" fontSize={8} fontFamily={MONO}
            letterSpacing="0.15em">
            L1
          </text>
          <circle cx={cx} cy={cy + 20} r={2.5} fill="#00FF88">
            <animate attributeName="opacity" values="1;0.3;1" dur="3s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Rollup nodes */}
        {nodePositions.map(node => {
          const isSelected = node.id === selectedChain;
          const isHovered = node.id === hoveredNode;
          const active = isSelected || isHovered;
          const isFocused = activeNodeId !== null;
          const nodeOpacity = node.isMainnetRef
            ? (active ? 0.7 : isFocused ? 0.12 : 0.4)
            : node.isExternalPeer
            ? (active ? 0.85 : isFocused ? 0.15 : 0.55)
            : active ? 1
            : isFocused ? (node.isLive ? 0.15 : 0.06)
            : (node.isLive ? 0.85 : 0.3);
          const nodeR = active ? node.r + 4 : node.r;

          const idx = nodePositions.indexOf(node);
          return (
            <g key={`${node.id}-${n}`}
              style={{
                cursor: "pointer",
                transition: "opacity 0.3s",
                animation: `ibc-node-enter 0.6s ease-out ${idx * 0.08}s both`,
              }}
              opacity={nodeOpacity}
              onClick={() => onSelect?.(node.id)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {active && (
                <circle cx={node.x} cy={node.y} r={nodeR + 6}
                  fill="none" stroke={node.color} strokeWidth={1}
                  strokeOpacity={0.3}
                >
                  <animate attributeName="r"
                    values={`${nodeR + 5};${nodeR + 8};${nodeR + 5}`}
                    dur="2.5s" repeatCount="indefinite"
                  />
                  <animate attributeName="stroke-opacity"
                    values="0.3;0.15;0.3"
                    dur="2.5s" repeatCount="indefinite"
                  />
                </circle>
              )}

              <circle cx={node.x} cy={node.y} r={nodeR}
                fill={`${node.color}${active ? "1A" : "0D"}`}
                stroke={node.color}
                strokeWidth={active ? 1.5 : 1}
                strokeOpacity={active ? 0.7 : node.isExternalPeer ? 0.4 : 0.3}
                strokeDasharray={node.isExternalPeer ? "3 2" : "none"}
                style={{ transition: "all 0.2s" }}
              />

              <text x={node.x} y={node.y + 1}
                textAnchor="middle" dominantBaseline="middle"
                fill={node.color}
                fillOpacity={active ? 1 : 0.75}
                fontSize={Math.round(nodeR * 0.52)}
                fontWeight={700} fontFamily={SANS}
                style={{ pointerEvents: "none" }}
              >
                {node.isOurs ? "IP" : node.name.slice(0, 2).toUpperCase()}
              </text>

              <text x={node.x} y={node.y + nodeR + 13}
                textAnchor="middle" dominantBaseline="middle"
                fill={active ? "#8AB4C8" : "#3A5A6A"}
                fontSize={active ? 10 : 9} fontFamily={MONO}
                style={{ pointerEvents: "none", transition: "fill 0.2s" }}
              >
                {node.name.length > 12 ? node.name.slice(0, 11) + "…" : node.name}
              </text>

              {node.isLive && (
                <circle cx={node.x + nodeR * 0.65} cy={node.y - nodeR * 0.65} r={3}
                  fill="#00FF88"
                >
                  <animate attributeName="opacity"
                    values="1;0.5;1" dur="2.5s" repeatCount="indefinite"
                  />
                </circle>
              )}

              {node.isOurs && (
                <text x={node.x} y={node.y - nodeR - 10}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#00FF88" fillOpacity={0.5}
                  fontSize={7} fontFamily={MONO} letterSpacing="0.15em"
                  style={{ pointerEvents: "none" }}
                >
                  PULSE
                </text>
              )}

              {node.isMainnetRef && (
                <text x={node.x} y={node.y - nodeR - 8}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#FF3366" fillOpacity={0.5}
                  fontSize={6} fontFamily={MONO} letterSpacing="0.12em"
                  style={{ pointerEvents: "none" }}
                >
                  MAINNET
                </text>
              )}

              {node.isExternalPeer && (
                <text x={node.x} y={node.y - nodeR - 8}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#6A8A9A" fillOpacity={0.6}
                  fontSize={6} fontFamily={MONO} letterSpacing="0.12em"
                  style={{ pointerEvents: "none" }}
                >
                  IBC
                </text>
              )}

              {/* Pulse Score badge */}
              {node.pulseScore !== null && node.isLive && (
                <g style={{ pointerEvents: "none" }}>
                  <text x={node.x} y={node.y + nodeR + 25}
                    textAnchor="middle" dominantBaseline="middle"
                    fill={scoreColor(node.pulseScore)}
                    fillOpacity={active ? 1 : 0.6}
                    fontSize={9} fontWeight={700} fontFamily={MONO}
                    style={{ transition: "fill-opacity 0.2s" }}
                  >
                    {node.pulseScore}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hoveredNode && (() => {
        const node = nodePositions.find(n => n.id === hoveredNode);
        if (!node) return null;
        const tooltipW = 180;
        const tooltipH = 78;
        let tx = node.x + node.r + 16;
        let ty = node.y - tooltipH / 2;
        if (tx + tooltipW > W - 20) tx = node.x - node.r - tooltipW - 16;
        if (ty < 10) ty = 10;
        if (ty + tooltipH > H - 10) ty = H - tooltipH - 10;

        return (
          <div style={{
            position: "absolute", left: tx, top: ty,
            width: tooltipW, padding: "10px 14px",
            background: "rgba(4,10,15,0.92)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: `1px solid ${node.color}25`,
            borderRadius: 5,
            pointerEvents: "none",
            animation: "fade-in 0.15s ease-out",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: node.isLive ? "#00FF88" : "#0A1218" }} />
              <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: "#E0F0FF" }}>
                {node.name}
              </span>
              {node.isExternalPeer && (
                <span style={{ fontFamily: MONO, fontSize: 8, color: "#6A8A9A", letterSpacing: "0.1em" }}>IBC</span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 14px" }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 7, color: "#0D1A24", letterSpacing: "0.15em", textTransform: "uppercase" }}>Blocks</div>
                <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: "#5A7A8A" }}>
                  {node.blockHeight > 0 ? formatNumber(node.blockHeight) : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 7, color: "#0D1A24", letterSpacing: "0.15em", textTransform: "uppercase" }}>Txs</div>
                <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: node.txCount > 0 ? node.color : "#0D1A24" }}>
                  {node.txCount > 0 ? formatNumber(node.txCount) : "—"}
                </div>
              </div>
            </div>
            {node.pulseScore !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, marginBottom: 2 }}>
                <span style={{ fontFamily: MONO, fontSize: 7, color: "#0D1A24", letterSpacing: "0.15em", textTransform: "uppercase" }}>Pulse</span>
                <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: scoreColor(node.pulseScore) }}>
                  {node.pulseScore}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: scoreColor(node.pulseScore), opacity: 0.6 }}>/100</span>
              </div>
            )}
            <div style={{ fontFamily: MONO, fontSize: 8, color: "#1E3040", marginTop: 3 }}>
              {node.channelCount} channel{node.channelCount !== 1 ? "s" : ""}
              {node.blockTime ? ` · ${node.blockTime.toFixed(1)}s` : ""}
              {" · click to inspect"}
            </div>
          </div>
        );
      })()}

      {/* Bottom legend */}
      <div style={{
        position: "absolute", bottom: 14, right: 16,
        display: "flex", alignItems: "center", gap: 12,
        pointerEvents: "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00FF88" }} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: "#1E3040" }}>{liveCount} live</span>
        </div>
        {nodes.some(n => n.isExternalPeer) && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#6A8A9A", opacity: 0.6 }} />
            <span style={{ fontFamily: MONO, fontSize: 8, color: "#6A8A9A" }}>IBC peer</span>
          </div>
        )}
        {nodes.some(n => !n.isLive && !n.isExternalPeer && !n.isMainnetRef) && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 14, height: 0, borderTop: "1px dashed #1E3040" }} />
            <span style={{ fontFamily: MONO, fontSize: 8, color: "#0D1A24" }}>dormant</span>
          </div>
        )}
        {nodes.some(n => n.isMainnetRef) && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#2A3A4A", border: "1px solid #1E3040" }} />
            <span style={{ fontFamily: MONO, fontSize: 8, color: "#FF3366", opacity: 0.5 }}>mainnet ref</span>
          </div>
        )}
      </div>
    </div>
  );
}
