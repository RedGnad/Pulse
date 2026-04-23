"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Send, Loader2, Sparkles, ArrowLeftRight, Zap,
  TrendingUp, Shield, BarChart3, Activity,
  CheckCircle2, XCircle, Coins, Lock, Vote,
  ExternalLink, ArrowRight, ShieldAlert, AlertTriangle,
} from "lucide-react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useWriteContract } from "wagmi";
import { calculateFee, GasPrice } from "@cosmjs/stargate";
import { useEcosystem } from "@/hooks/use-ecosystem";
import { initiaPulse } from "@/lib/wagmi-config";
import { useUsername } from "@/hooks/use-username";
import { useNetwork } from "@/contexts/network-context";
import { scoreColor } from "@/lib/pulse-score";
import { computePulseScore, scoreLabel } from "@/lib/pulse-score";
import { computeL1Health } from "@/lib/l1-health";
import { deriveRisks, risksForAction, Risk } from "@/lib/risks";
import {
  Action, Target, L1_ONLY_ACTIONS, buildTargets, parseIntent, inferAction,
} from "@/lib/action-routing";
import { GateBadge } from "@/components/gate-badge";
import { PulseLogo } from "@/components/pulse-logo";
import type { ActionIntent } from "@/lib/action-parser";
import type { MinitiaWithMetrics } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RoutingData {
  action: Action;
  targets: Target[];
  allRisks: Risk[];
  parsedIntent: { verbs: string[]; assets: string[]; modifiers: string[] } | null;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  action?: ActionIntent | null;
  actions?: ActionIntent[];
  routing?: RoutingData;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MONO = "var(--font-jetbrains), monospace";
const SANS = "var(--font-chakra), sans-serif";

const ACTION_LABELS: Record<Action, string> = {
  bridge: "Bridge", trade: "DeFi", play: "Gaming",
  mint: "NFT", send: "Send", stake: "Staking", vote: "Governance",
};

const CATEGORIES = [
  {
    icon: Activity, label: "Ecosystem",
    questions: [
      "Give me a full ecosystem health report",
      "Which minitia is the most active right now?",
      "Are there any anomalies across the network?",
    ],
  },
  {
    icon: TrendingUp, label: "Staking",
    questions: [
      "Stake 1 INIT on Chorus One",
      "Best validators to stake with for a balanced portfolio?",
      { display: "Unstake 1 INIT from Chorus One then send 1 INIT to @alice", value: "Unstake 1 INIT from Chorus One then send 1 INIT to @alice" },
    ],
  },
  {
    icon: ArrowLeftRight, label: "Bridge",
    questions: [
      "Bridge 5 INIT to a rollup",
      "What's the fastest bridge path between minitias?",
      "Show me active bridge channels and their status",
    ],
  },
  {
    icon: Shield, label: "Security",
    questions: [
      "Which minitias have oracle-enabled bridges?",
      "What's the finalization period for OPinit bridges?",
      "How decentralized is the validator set?",
    ],
  },
  {
    icon: Zap, label: "Deploy",
    questions: [
      "Where should I deploy a DeFi app on Initia?",
      "Compare minitia block times and throughput",
      "Which rollups support Celestia DA?",
    ],
  },
  {
    icon: BarChart3, label: "Data",
    questions: [
      { display: "Send 0.1 INIT to init1ajx...0q", value: "Send 0.1 INIT to init1ajxy7nlac0k2p88qrlng5xq5aptaz5sc0g6d0q" },
      "What proposals are open — can I vote from here?",
      "Where are my staked funds?",
    ],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map((para, pi) => {
    const parts = para.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} style={{ color: "#E0F0FF", fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
      }
      return part.split("\n").map((line, li, arr) => (
        <span key={`${i}-${li}`}>{line}{li < arr.length - 1 && <br />}</span>
      ));
    });
    return <p key={pi} style={{ margin: pi > 0 ? "10px 0 0" : 0 }}>{rendered}</p>;
  });
}

function friendlyTxError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("invalid to address") || r.includes("invalid address"))
    return "Invalid recipient address. Please check the init1... address and try again.";
  if (r.includes("insufficient fund") || r.includes("insufficient balance"))
    return "Insufficient balance. You don't have enough INIT for this transaction.";
  if (r.includes("out of gas") || r.includes("gas cannot be zero"))
    return "Transaction ran out of gas. Please try again.";
  if (r.includes("user rejected") || r.includes("user denied") || r.includes("user cancel"))
    return "Transaction cancelled.";
  if (r.includes("sequence mismatch") || r.includes("account sequence"))
    return "Sequence error — please wait a few seconds and try again.";
  if (r.includes("not found") && r.includes("validator"))
    return "Validator not found on the network. Check the validator name or address.";
  if (r.includes("collections: not found"))
    return "Authorization error. Try disconnecting your wallet, reconnecting, and enabling auto-sign again.";
  return raw.length > 120 ? raw.slice(0, 120) + "…" : raw;
}

function risksActionKey(action: Action): "bridge" | "stake" | "send" | "vote" {
  if (action === "stake" || action === "vote" || action === "send" || action === "bridge") return action;
  return "bridge";
}

// ─── Main page component ───────────────────────────────────────────────────

function AskPulsePageInner() {
  const sp = useSearchParams();
  const initialQ = sp.get("prompt") ?? sp.get("q") ?? sp.get("intent") ?? "";
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState(initialQ);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const didAutoSendRef = useRef(false);
  const {
    openBridge, requestTxSync, submitTxBlock, estimateGas,
    autoSign, initiaAddress, isConnected, openConnect,
  } = useInterwovenKit();
  const { data: ecosystem } = useEcosystem();
  const { username } = useUsername(initiaAddress);
  const { network } = useNetwork();
  const [txStatus, setTxStatus] = useState<Record<string, "idle" | "signing" | "pending" | "success" | "error">>({});
  const [txHash, setTxHash] = useState<Record<string, string>>({});
  const [txError, setTxError] = useState<Record<string, string>>({});

  // ── Routing: ecosystem scoring ──
  const scoredRollups = (() => {
    if (!ecosystem) return [];
    return ecosystem.minitias
      .filter(m => (m.metrics?.blockHeight ?? 0) > 0 || m.profile)
      .map(m => {
        const total = computePulseScore(m, ecosystem.minitias, ecosystem.ibcChannels).total;
        return { minitia: m, score: total, color: scoreColor(total), label: scoreLabel(total) };
      })
      .sort((a, b) => b.score - a.score);
  })();
  const l1Health = ecosystem ? computeL1Health(ecosystem.l1) : null;
  const allRisks = ecosystem ? deriveRisks(ecosystem) : [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const sendMessage = useCallback(
    async (msg?: string) => {
      const text = (msg ?? input).trim();
      if (!text || loading) return;
      setInput("");
      const userMsg: ChatMsg = { role: "user", content: text, timestamp: Date.now() };
      let newChat = [...chat, userMsg];

      // ── Routing: detect intent and insert routing cards instantly ──
      const detectedAction = inferAction(text);
      if (detectedAction && ecosystem && l1Health) {
        const parsed = parseIntent(text, detectedAction);
        const hasParsed = parsed.verbs.length > 0 || parsed.assets.length > 0 || parsed.modifiers.length > 0;
        const targets = buildTargets(detectedAction, ecosystem, l1Health, scoredRollups, hasParsed ? parsed : null);
        if (targets.length > 0) {
          const routingMsg: ChatMsg = {
            role: "assistant",
            content: `Found ${targets.length} ${targets.length === 1 ? "match" : "matches"} for your intent.`,
            timestamp: Date.now(),
            routing: {
              action: detectedAction,
              targets,
              allRisks,
              parsedIntent: hasParsed ? parsed : null,
            },
          };
          newChat = [...newChat, routingMsg];
        }
      }

      setChat(newChat);
      setLoading(true);
      if (inputRef.current) inputRef.current.style.height = "44px";

      try {
        const res = await fetch("/api/insights/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: chat.map(m => ({ role: m.role, content: m.content })),
            mode: "full",
            network,
            userAddress: initiaAddress || undefined,
            username: username || undefined,
          }),
        });
        const json = await res.json();
        const response = json.response || json.error;
        const actions: ActionIntent[] = json.actions ?? (json.action ? [json.action] : []);
        setChat([...newChat, {
          role: "assistant", content: response, timestamp: Date.now(),
          action: actions[0] ?? null, actions,
        }]);
      } catch {
        setChat([...newChat, {
          role: "assistant",
          content: "Connection error. The ecosystem data feed may be temporarily unavailable.",
          timestamp: Date.now(),
        }]);
      } finally {
        setLoading(false);
      }
    },
    [chat, input, loading, network, initiaAddress, username, ecosystem, l1Health, scoredRollups, allRisks],
  );

  useEffect(() => {
    if (!initialQ || didAutoSendRef.current) return;
    didAutoSendRef.current = true;
    sendMessage(initialQ);
  }, [initialQ, sendMessage]);

  function handleBridge() {
    openBridge({ srcChainId: "initiation-2", srcDenom: "uinit" });
  }

  const { writeContractAsync } = useWriteContract();

  const executeAction = useCallback(
    async (action: ActionIntent, key: string) => {
      if (!isConnected) { openConnect(); return; }
      if (action.type === "bridge") { openBridge({ srcChainId: "initiation-2", srcDenom: "uinit" }); return; }
      if (action.type === "vote") {
        setTxStatus(prev => ({ ...prev, [key]: "signing" }));
        try {
          const hash = await writeContractAsync({
            address: PULSE_GOV_ADDRESS as `0x${string}`,
            abi: PULSE_GOV_ABI, functionName: "vote",
            args: [BigInt(action.params.proposalId ?? "0"), action.params.voteOption ?? 1],
            chainId: initiaPulse.id,
          });
          setTxHash(prev => ({ ...prev, [key]: hash }));
          setTxStatus(prev => ({ ...prev, [key]: "success" }));
        } catch (err) {
          setTxStatus(prev => ({ ...prev, [key]: "error" }));
          const raw = err instanceof Error ? err.message : "Vote transaction failed";
          setTxError(prev => ({ ...prev, [key]: friendlyTxError(raw) }));
        }
        return;
      }

      setTxStatus(prev => ({ ...prev, [key]: "signing" }));
      try {
        const chainId = action.chainId || "initiation-2";
        const amountMicro = String(Math.floor(parseFloat(action.params.amount || "0") * 1_000_000));
        let messages: { typeUrl: string; value: unknown }[];

        if (action.type === "send") {
          messages = [{ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: { fromAddress: initiaAddress, toAddress: action.params.recipient, amount: [{ denom: "uinit", amount: amountMicro }] } }];
        } else if (action.type === "stake" || action.type === "unstake") {
          if (!action.params.validator) {
            setTxStatus(prev => ({ ...prev, [key]: "error" }));
            setTxError(prev => ({ ...prev, [key]: "Validator address not resolved. Use a full initvaloper address." }));
            return;
          }
          const typeUrl = action.type === "stake" ? "/initia.mstaking.v1.MsgDelegate" : "/initia.mstaking.v1.MsgUndelegate";
          messages = [{ typeUrl, value: { delegatorAddress: initiaAddress, validatorAddress: action.params.validator, amount: [{ denom: "uinit", amount: amountMicro }] } }];
        } else { return; }

        if (!autoSign?.isEnabledByChain?.[chainId]) { await autoSign?.enable(chainId); }
        const isAutoSignActive = !!autoSign?.isEnabledByChain?.[chainId];
        setTxStatus(prev => ({ ...prev, [key]: "pending" }));

        let hash: string;
        if (isAutoSignActive) {
          const gasEstimate = await estimateGas({ messages, chainId });
          const fee = calculateFee(Math.ceil(gasEstimate * 1.4), GasPrice.fromString("0.015uinit"));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result: any = await submitTxBlock({ messages, fee, chainId });
          hash = result?.transactionHash ?? result?.txhash ?? "";
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          hash = await (requestTxSync as any)({ messages, chainId });
        }
        setTxHash(prev => ({ ...prev, [key]: hash }));
        setTxStatus(prev => ({ ...prev, [key]: "success" }));
      } catch (err) {
        setTxStatus(prev => ({ ...prev, [key]: "error" }));
        const raw = err instanceof Error ? err.message : "Transaction failed";
        setTxError(prev => ({ ...prev, [key]: friendlyTxError(raw) }));
        setChat(prev => [...prev, {
          role: "assistant" as const,
          content: `**Transaction failed:** ${friendlyTxError(raw)}\n\nThis can happen if you don't have enough INIT to cover the amount + gas fees, if auto-sign session expired, or if the network is congested. You can try again — if the issue persists, try disconnecting and reconnecting your wallet to reset the session.`,
          timestamp: Date.now(),
        }]);
      }
    },
    [isConnected, openConnect, openBridge, autoSign, initiaAddress, requestTxSync, submitTxBlock, estimateGas, writeContractAsync],
  );

  const lastMsg = chat.length > 0 ? chat[chat.length - 1] : null;
  const showBridgeAction = lastMsg?.role === "assistant" && !lastMsg.action && /bridge|transfer|move.*init/i.test(lastMsg.content);
  const hasMessages = chat.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>

        {/* Background ambient */}
        <div style={{
          position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)",
          width: 800, height: 600,
          background: "radial-gradient(ellipse, rgba(0,255,136,0.03) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{
          flex: 1, maxWidth: 820, width: "100%", margin: "0 auto", padding: "0 24px",
          display: "flex", flexDirection: "column", position: "relative", zIndex: 1,
        }}>

          {/* Gate badge */}
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 16 }}>
            <GateBadge />
          </div>

          {/* ── Empty state: hero + categories ── */}
          {!hasMessages && (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              justifyContent: "flex-start", alignItems: "center",
              paddingTop: 40, paddingBottom: 180, overflowY: "auto",
              animation: "fade-in 0.6s ease-out",
            }}>
              {/* Hero */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, marginBottom: 48 }}>
                <div style={{
                  position: "relative",
                  width: 84, height: 84, borderRadius: 20,
                  background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 60px rgba(0,255,136,0.12), inset 0 0 40px rgba(0,255,136,0.04)",
                }}>
                  <PulseLogo size={44} color="#00FF88" animated />
                  <span style={{
                    position: "absolute", inset: -1, borderRadius: 20,
                    border: "1px solid rgba(0,255,136,0.5)",
                    animation: "header-ping 3s cubic-bezier(0, 0, 0.2, 1) infinite",
                    pointerEvents: "none",
                  }} />
                </div>
                <h1 style={{
                  fontFamily: SANS, fontSize: 44, fontWeight: 800,
                  color: "#E0F0FF", margin: 0, letterSpacing: "-0.025em", lineHeight: 1.05,
                  textAlign: "center",
                }}>
                  Route any intent on Initia.
                </h1>
                <p style={{
                  fontFamily: MONO, fontSize: 13, color: "#8AB4C8",
                  margin: 0, textAlign: "center", lineHeight: 1.6, maxWidth: 520,
                }}>
                  Describe what you want to do — stake, bridge, send, vote, deploy —
                  <br />
                  and Pulse routes you to the right minitia with a live health check.
                </p>

                {isConnected && initiaAddress && (
                  <p style={{ fontFamily: MONO, fontSize: 12, color: username ? "#00FF88" : "#5A7A8A", margin: 0 }}>
                    {username ? `Connected as @${username}` : `${initiaAddress.slice(0, 12)}...${initiaAddress.slice(-4)}`}
                  </p>
                )}

                {/* Live data indicator */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 14px", border: "1px solid rgba(0,255,136,0.1)",
                  borderRadius: 20, background: "rgba(0,255,136,0.03)", marginTop: 4,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%", background: "#00FF88",
                    boxShadow: "0 0 8px #00FF88", animation: "pulse-glow-green 2s infinite",
                  }} />
                  <span style={{ fontFamily: MONO, fontSize: 12, color: "#00FF88", letterSpacing: "0.08em" }}>
                    Connected to live ecosystem feed
                  </span>
                </div>

                {/* Live Pulse Scores */}
                {ecosystem?.minitias && (() => {
                  const scored = ecosystem.minitias
                    .filter(m => m.pulseScore && (m.metrics?.blockHeight ?? 0) > 0)
                    .sort((a, b) => (b.pulseScore?.total ?? 0) - (a.pulseScore?.total ?? 0))
                    .slice(0, 5);
                  if (!scored.length) return null;
                  return (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 16,
                      padding: "8px 16px", border: "1px solid rgba(255,255,255,0.04)",
                      borderRadius: 8, background: "rgba(255,255,255,0.01)", marginTop: 4,
                    }}>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: "#3A5A6A", letterSpacing: "0.1em" }}>
                        PULSE SCORES
                      </span>
                      {scored.map(m => (
                        <div key={m.chainId} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontFamily: MONO, fontSize: 12, color: "#5A7A8A" }}>{m.prettyName}</span>
                          <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: scoreColor(m.pulseScore?.total ?? 0) }}>
                            {m.pulseScore?.total}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Category grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%", maxWidth: 700 }}>
                {CATEGORIES.map(cat => (
                  <CategoryCard key={cat.label} icon={cat.icon} label={cat.label}
                    questions={cat.questions} onSelect={sendMessage} />
                ))}
              </div>
            </div>
          )}

          {/* ── Chat messages ── */}
          {hasMessages && (
            <div style={{
              flex: 1, overflowY: "auto", paddingTop: 16, paddingBottom: 140,
              display: "flex", flexDirection: "column", gap: 24,
            }}>
              {/* Chat header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 0", borderBottom: "1px solid rgba(0,255,136,0.06)", marginBottom: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles style={{ width: 14, height: 14, color: "#00FF88" }} />
                  <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: "#E0F0FF" }}>Ask Pulse</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: "#3A5A6A" }}>
                    {chat.filter(m => m.role === "user").length} messages
                  </span>
                </div>
                <button
                  onClick={() => setChat([])}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 12px", borderRadius: 4,
                    border: "1px solid rgba(0,255,136,0.1)", background: "rgba(0,255,136,0.03)",
                    cursor: "pointer", fontFamily: MONO, fontSize: 11, color: "#5A7A8A",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,255,136,0.25)"; e.currentTarget.style.color = "#00FF88"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,255,136,0.1)"; e.currentTarget.style.color = "#5A7A8A"; }}
                >
                  New chat
                </button>
              </div>

              {chat.map((m, i) => {
                const actions = m.actions?.length ? m.actions : m.action ? [m.action] : [];
                return (
                  <div key={i}>
                    <MessageBubble msg={m} />

                    {/* Routing cards (when intent was detected) */}
                    {m.role === "assistant" && m.routing && (
                      <RoutingResponse routing={m.routing} onAskPulse={sendMessage} />
                    )}

                    {/* Action cards for tx execution */}
                    {m.role === "assistant" && actions.map((action, ai) => {
                      const key = `${i}-${ai}`;
                      return (
                        <ActionCard key={key} action={action} actionKey={key}
                          status={txStatus[key] ?? "idle"} hash={txHash[key]} error={txError[key]}
                          onExecute={executeAction} onBridge={handleBridge}
                          connected={isConnected}
                          step={actions.length > 1 ? ai + 1 : undefined}
                          totalSteps={actions.length > 1 ? actions.length : undefined}
                        />
                      );
                    })}
                  </div>
                );
              })}

              {showBridgeAction && (
                <div style={{ display: "flex", paddingLeft: 44 }}>
                  <button onClick={handleBridge} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 18px", borderRadius: 8,
                    background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.2)",
                    cursor: "pointer", fontFamily: MONO, fontSize: 12, color: "#00FF88",
                  }}>
                    <ArrowLeftRight style={{ width: 14, height: 14 }} />
                    Open Bridge — Transfer INIT
                  </button>
                </div>
              )}

              {loading && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Sparkles style={{ width: 14, height: 14, color: "#00FF88" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                    <Loader2 style={{ width: 14, height: 14, color: "#00FF88" }} className="animate-spin" />
                    <span style={{ fontFamily: MONO, fontSize: 12, color: "#5A7A8A" }}>
                      Analyzing with live ecosystem data...
                    </span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ── Input bar ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10,
        background: "linear-gradient(to top, rgba(4,10,15,1) 60%, rgba(4,10,15,0))",
        padding: "32px 24px 24px",
      }}>
        <form
          onSubmit={e => { e.preventDefault(); sendMessage(); }}
          style={{
            maxWidth: 820, margin: "0 auto",
            display: "flex", alignItems: "flex-end", gap: 12,
            padding: "12px 16px", borderRadius: 12,
            border: "1px solid rgba(0,255,136,0.12)",
            background: "rgba(10,18,24,0.95)", backdropFilter: "blur(24px)",
            boxShadow: "0 -4px 32px rgba(0,0,0,0.4), 0 0 60px rgba(0,255,136,0.03)",
            transition: "border-color 0.15s",
          }}
          onFocus={e => { (e.currentTarget as HTMLFormElement).style.borderColor = "rgba(0,255,136,0.25)"; }}
          onBlur={e => { (e.currentTarget as HTMLFormElement).style.borderColor = "rgba(0,255,136,0.12)"; }}
        >
          <Sparkles style={{ width: 16, height: 16, color: "#00FF88", opacity: 0.5, flexShrink: 0, marginBottom: 4 }} />
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = "44px";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask about the Initia ecosystem, or describe an action..."
            disabled={loading}
            rows={1}
            style={{
              flex: 1, border: "none", background: "transparent",
              fontFamily: MONO, fontSize: 13, color: "#8AB4C8",
              outline: "none", resize: "none", height: 44, lineHeight: "22px", padding: "11px 0",
            }}
          />
          <button
            type="submit" disabled={!input.trim() || loading}
            style={{
              width: 36, height: 36, borderRadius: 8, border: "none",
              background: input.trim() && !loading ? "rgba(0,255,136,0.15)" : "rgba(0,255,136,0.04)",
              cursor: input.trim() && !loading ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s", flexShrink: 0,
            }}
          >
            <Send style={{ width: 15, height: 15, color: input.trim() && !loading ? "#00FF88" : "#3A5A6A" }} />
          </button>
        </form>

        {/* Auto-sign toggle — testnet only */}
        {network === "testnet" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}>
            {(() => {
              const enabled = !!autoSign?.isEnabledByChain?.["initiation-2"];
              return (
                <button
                  onClick={async () => {
                    if (!isConnected) { openConnect(); return; }
                    if (!autoSign) return;
                    const chainId = "initiation-2";
                    if (enabled) { try { await autoSign.disable(chainId); } catch { await autoSign.enable(chainId); } }
                    else { await autoSign.enable(chainId); }
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "6px 14px", borderRadius: 8,
                    border: `1px solid ${enabled ? "rgba(0,255,136,0.35)" : "rgba(138,180,200,0.2)"}`,
                    background: enabled ? "rgba(0,255,136,0.1)" : "rgba(138,180,200,0.06)",
                    cursor: "pointer", fontFamily: MONO, fontSize: 12,
                    color: enabled ? "#00FF88" : "#8AB4C8",
                    transition: "all 0.2s", letterSpacing: 0.3,
                  }}
                >
                  <Zap style={{ width: 12, height: 12 }} />
                  Auto-sign {enabled ? "ON" : "OFF"}
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: enabled ? "#00FF88" : "#3A5A6A",
                    boxShadow: enabled ? "0 0 6px rgba(0,255,136,0.5)" : "none",
                  }} />
                </button>
              );
            })()}
          </div>
        )}

        <p style={{ textAlign: "center", fontFamily: MONO, fontSize: 11, color: "#3A5A6A", marginTop: 8 }}>
          Pulse AI analyzes live on-chain data from{" "}
          {ecosystem?.minitias?.filter(m => (m.metrics?.blockHeight ?? 0) > 0).length ?? "—"}{" "}
          rollups in real-time
        </p>
      </div>
    </div>
  );
}

// ─── Category Card ──────────────────────────────────────────────────────────

function CategoryCard({ icon: Icon, label, questions, onSelect }: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { style?: React.CSSProperties }>;
  label: string;
  questions: (string | { display: string; value: string })[];
  onSelect: (q: string) => void;
}) {
  return (
    <div style={{
      borderRadius: 10, border: "1px solid rgba(0,255,136,0.08)",
      background: "rgba(10,18,24,0.6)", padding: 14, transition: "all 0.2s",
      position: "relative", overflow: "hidden",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,255,136,0.2)"; e.currentTarget.style.background = "rgba(0,255,136,0.04)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,255,136,0.08)"; e.currentTarget.style.background = "rgba(10,18,24,0.6)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon style={{ width: 14, height: 14, color: "#5A7A8A" }} />
        <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: "#8AB4C8" }}>{label}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {questions.map(q => {
          const display = typeof q === "string" ? q : q.display;
          const value = typeof q === "string" ? q : q.value;
          return (
            <button key={display} onClick={e => { e.stopPropagation(); onSelect(value); }}
              style={{
                textAlign: "left", padding: "6px 8px", borderRadius: 4,
                border: "none", background: "transparent", cursor: "pointer",
                fontFamily: MONO, fontSize: 12, color: "#5A7A8A", lineHeight: 1.4,
                transition: "all 0.1s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,255,136,0.06)"; e.currentTarget.style.color = "#00FF88"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#5A7A8A"; }}
            >
              {display}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (isUser) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          maxWidth: "75%", padding: "12px 16px",
          borderRadius: "12px 12px 4px 12px",
          background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)",
        }}>
          <p style={{ margin: 0, fontFamily: MONO, fontSize: 13, color: "#8AB4C8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {msg.content}
          </p>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "#3A5A6A", display: "block", marginTop: 6, textAlign: "right" }}>
            {time}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, marginTop: 2,
      }}>
        <Sparkles style={{ width: 14, height: 14, color: "#00FF88" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: "#00FF88" }}>Pulse AI</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "#3A5A6A" }}>{time}</span>
          {msg.routing && (
            <span style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "#00FF88",
              padding: "2px 7px", borderRadius: 3,
              background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)",
              letterSpacing: "0.06em",
            }}>
              {ACTION_LABELS[msg.routing.action]}
            </span>
          )}
        </div>
        <div style={{
          padding: "14px 18px", borderRadius: "4px 12px 12px 12px",
          background: "rgba(10,18,24,0.8)", border: "1px solid rgba(0,255,136,0.06)",
        }}>
          <div style={{ fontFamily: MONO, fontSize: 12, color: "#8AB4C8", lineHeight: 1.8, wordBreak: "break-word" }}>
            {renderMarkdown(msg.content)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Routing Response (inline cards) ────────────────────────────────────────

function RoutingResponse({ routing, onAskPulse }: {
  routing: RoutingData;
  onAskPulse: (prompt: string) => void;
}) {
  const { action, targets, allRisks, parsedIntent } = routing;
  const topTarget = targets[0] ?? null;
  const otherTargets = targets.slice(1);

  return (
    <div style={{ paddingLeft: 44, marginTop: 8, marginBottom: 4 }}>
      {/* Parsed intent tokens */}
      {parsedIntent && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8, fontFamily: MONO, fontSize: 10 }}>
          {parsedIntent.verbs.map(v => (
            <span key={`v-${v}`} style={{ color: "#00FF88", padding: "2px 7px", borderRadius: 3, background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.18)" }}>{v}</span>
          ))}
          {parsedIntent.assets.map(a => (
            <span key={`a-${a}`} style={{ color: "#00D4FF", padding: "2px 7px", borderRadius: 3, background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.18)" }}>{a.toUpperCase()}</span>
          ))}
          {parsedIntent.modifiers.map(m => (
            <span key={`m-${m}`} style={{ color: "#A78BFA", padding: "2px 7px", borderRadius: 3, background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.18)" }}>{m}</span>
          ))}
        </div>
      )}

      {/* L1-only banner */}
      {L1_ONLY_ACTIONS.has(action) && (
        <div style={{
          marginBottom: 8, padding: "10px 14px", borderRadius: 6,
          border: "1px solid rgba(0,212,255,0.18)", background: "rgba(0,212,255,0.04)",
          fontFamily: MONO, fontSize: 11, color: "#8AB4C8", lineHeight: 1.5,
        }}>
          <strong style={{ color: "#E0F0FF" }}>
            {action === "stake" ? "Staking" : "Governance"} happens on Initia L1.
          </strong>{" "}
          Minitias are OPinit rollups — no bonded validators, no gov module.
        </div>
      )}

      {topTarget && <RoutingHeroCard target={topTarget} action={action} risks={topTarget.kind === "rollup" ? risksForAction(allRisks, risksActionKey(action), topTarget.chainId) : []} onAskPulse={onAskPulse} />}
      {otherTargets.map((t, i) => (
        <RoutingCompactCard key={t.chainId} target={t} action={action}
          risks={t.kind === "rollup" ? risksForAction(allRisks, risksActionKey(action), t.chainId) : []}
          rank={i + 2} onAskPulse={onAskPulse} />
      ))}
    </div>
  );
}

// ─── Routing cards ──────────────────────────────────────────────────────────

const VERDICT_META = {
  allow: { color: "#00FF88", Icon: CheckCircle2, label: "ROUTE CLEAR" },
  warn:  { color: "#FFB800", Icon: ShieldAlert,  label: "CAUTION" },
  block: { color: "#FF3366", Icon: AlertTriangle, label: "BLOCKED" },
} as const;

function computeVerdict(target: Target, risks: Risk[]): "allow" | "warn" | "block" {
  if (target.kind === "l1") return target.health.score < 25 ? "block" : target.health.score < 50 ? "warn" : "allow";
  const critical = risks.filter(r => r.severity === "critical");
  const elevated = risks.filter(r => r.severity === "elevated");
  return critical.length > 0 ? "block" : elevated.length > 0 ? "warn" : "allow";
}

function buildAskPrompt(target: Target, action: Action, verdict: "allow" | "warn" | "block"): string {
  if (target.kind === "rollup") {
    const name = target.minitia.prettyName ?? target.minitia.name;
    if (verdict === "block") return `Pulse just blocked a ${action} on ${name} (${target.chainId}). Explain which specific risks caused the block.`;
    switch (action) {
      case "bridge": return `I want to bridge to ${name} (${target.chainId}). Pulse says ${verdict}. Walk me through the safest route.`;
      case "trade":  return `I want to trade on ${name} (${target.chainId}). Pulse says ${verdict}. What can I do there?`;
      case "play":   return `I want to interact with ${name} (${target.chainId}). What's live on this rollup right now?`;
      case "mint":   return `I want to mint or trade NFTs on ${name} (${target.chainId}). Is the launchpad live?`;
      case "send":   return `I want to send tokens on ${name}. Confirm the chain is live.`;
      case "stake":  return `I want to stake on ${name}. Pulse says ${verdict}.`;
      case "vote":   return `Any active governance proposals on ${name}? Pulse says ${verdict}.`;
    }
  }
  if (verdict === "block") return `Pulse blocked ${action} on Initia L1. Which issue triggered it?`;
  switch (action) {
    case "stake":  return `I want to stake INIT on Initia L1. Which validator is the safest pick right now?`;
    case "vote":   return `Show me active governance proposals on Initia L1.`;
    case "bridge": return `I want to bridge to Initia L1. What's the safest route?`;
    case "send":   return `Send tokens on Initia L1. Confirm the chain is live.`;
    default:       return `${action} on Initia — what should I do?`;
  }
}

function CategoryBadge({ category }: { category: string }) {
  const palette: Record<string, string> = { "L1": "#00FF88", "DeFi": "#00D4FF", "Gaming": "#A78BFA", "NFT": "#FFB800" };
  const color = palette[category] ?? "#5A7A8A";
  return (
    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color, letterSpacing: "0.08em", padding: "2px 6px", borderRadius: 2, background: `${color}12`, border: `1px solid ${color}28` }}>
      {category.toUpperCase()}
    </span>
  );
}

function RoutingHeroCard({ target, action, risks, onAskPulse }: {
  target: Target; action: Action; risks: Risk[];
  onAskPulse: (prompt: string) => void;
}) {
  const verdict = computeVerdict(target, risks);
  const vm = VERDICT_META[verdict];
  const minitia = target.kind === "rollup" ? target.minitia : undefined;
  const website = minitia?.profile?.website;
  const isRollupExecution = action === "trade" || action === "play" || action === "mint";
  const externalHref = isRollupExecution && website && verdict !== "block" ? website : undefined;

  return (
    <div style={{
      marginBottom: 8, borderRadius: 10,
      border: `1px solid ${vm.color}30`, background: `linear-gradient(135deg, ${vm.color}08, rgba(4,10,15,0.5))`,
      overflow: "hidden",
    }}>
      <div style={{ padding: "14px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontFamily: MONO, fontSize: 9, fontWeight: 700, color: vm.color,
            padding: "2px 7px", borderRadius: 3, background: `${vm.color}12`, border: `1px solid ${vm.color}30`,
          }}>
            <vm.Icon style={{ width: 10, height: 10 }} />
            {vm.label}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: "#5A7A8A" }}>#1 match</span>
          <span style={{
            marginLeft: "auto", fontFamily: MONO, fontSize: 10, fontWeight: 700, color: target.color,
            padding: "2px 7px", borderRadius: 3, background: `${target.color}12`, border: `1px solid ${target.color}25`,
          }}>
            {target.label} · {target.score}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontFamily: SANS, fontSize: 18, fontWeight: 800, color: "#E0F0FF" }}>{target.name}</span>
          {target.category && <CategoryBadge category={target.category} />}
        </div>
        {target.description && (
          <div style={{ fontFamily: MONO, fontSize: 11, color: "#8AB4C8", lineHeight: 1.5, marginBottom: 6, maxWidth: 500 }}>
            {target.description}
          </div>
        )}
      </div>
      {/* CTAs */}
      <div style={{ padding: "0 16px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {externalHref && (
          <a href={externalHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <div style={{
              padding: "8px 14px", borderRadius: 6,
              border: `1px solid ${vm.color}40`, background: `${vm.color}0A`,
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: MONO, fontSize: 11, fontWeight: 700, color: "#00FF88",
            }}>
              Open {target.name} <ExternalLink style={{ width: 11, height: 11 }} />
            </div>
          </a>
        )}
        <button onClick={() => onAskPulse(buildAskPrompt(target, action, verdict))}
          disabled={verdict === "block"}
          style={{
            padding: "8px 14px", borderRadius: 6,
            border: "1px solid rgba(0,212,255,0.15)", background: "rgba(0,212,255,0.04)",
            display: "flex", alignItems: "center", gap: 6,
            fontFamily: MONO, fontSize: 11, color: "#8AB4C8", cursor: verdict === "block" ? "not-allowed" : "pointer",
            opacity: verdict === "block" ? 0.5 : 1,
          }}>
          <Sparkles style={{ width: 11, height: 11 }} /> Deep analysis
        </button>
      </div>
    </div>
  );
}

function RoutingCompactCard({ target, action, risks, rank, onAskPulse }: {
  target: Target; action: Action; risks: Risk[]; rank: number;
  onAskPulse: (prompt: string) => void;
}) {
  const verdict = computeVerdict(target, risks);
  const vm = VERDICT_META[verdict];
  const minitia = target.kind === "rollup" ? target.minitia : undefined;
  const website = minitia?.profile?.website;
  const isRollupExecution = action === "trade" || action === "play" || action === "mint";
  const externalHref = isRollupExecution && website && verdict !== "block" ? website : undefined;

  return (
    <div style={{
      marginBottom: 4, padding: "10px 14px", borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.06)", background: "rgba(10,18,24,0.5)",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "#3A5A6A", width: 18, textAlign: "center", flexShrink: 0 }}>
        {rank}
      </span>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: vm.color, boxShadow: `0 0 5px ${vm.color}`, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: "#E0F0FF" }}>{target.name}</span>
          {target.category && <CategoryBadge category={target.category} />}
        </div>
      </div>
      <span style={{
        fontFamily: MONO, fontSize: 10, fontWeight: 700, color: target.color,
        padding: "2px 6px", borderRadius: 3, background: `${target.color}12`, flexShrink: 0,
      }}>
        {target.score}
      </span>
      {externalHref ? (
        <a href={externalHref} target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "#00FF88", padding: "4px 8px", borderRadius: 4, background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.2)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          Open <ExternalLink style={{ width: 9, height: 9 }} />
        </a>
      ) : (
        <button onClick={() => onAskPulse(buildAskPrompt(target, action, verdict))}
          style={{ fontFamily: MONO, fontSize: 10, color: "#8AB4C8", padding: "4px 8px", borderRadius: 4, background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <Sparkles style={{ width: 9, height: 9 }} /> Ask
        </button>
      )}
    </div>
  );
}

// ─── Action Card (tx execution) ─────────────────────────────────────────────

const PULSE_GOV_ADDRESS = process.env.NEXT_PUBLIC_PULSE_GOV_ADDRESS ?? "0x7134FC77B9E88113c0A57602495f3146A879F820";
const PULSE_GOV_ABI = [
  { name: "vote", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "proposalId", type: "uint64" }, { name: "option", type: "uint8" }], outputs: [] },
] as const;

const ACTION_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement> & { style?: React.CSSProperties }>> = {
  send: Coins, stake: Lock, unstake: Lock, bridge: ArrowLeftRight, vote: Vote,
};

function ActionCard({ action, actionKey, status, hash, error, onExecute, onBridge, connected, step, totalSteps }: {
  action: ActionIntent; actionKey: string;
  status: "idle" | "signing" | "pending" | "success" | "error";
  hash?: string; error?: string;
  onExecute: (action: ActionIntent, key: string) => void;
  onBridge: () => void; connected: boolean;
  step?: number; totalSteps?: number;
}) {
  const Icon = ACTION_ICONS[action.type] ?? Zap;
  const isExecuting = status === "signing" || status === "pending";

  return (
    <div style={{ paddingLeft: 44, marginTop: 8 }}>
      <div style={{
        padding: "14px 18px", borderRadius: 10, maxWidth: 420,
        background: status === "success" ? "rgba(0,255,136,0.04)" : status === "error" ? "rgba(255,60,60,0.04)" : "rgba(0,255,136,0.02)",
        border: `1px solid ${status === "success" ? "rgba(0,255,136,0.25)" : status === "error" ? "rgba(255,60,60,0.2)" : "rgba(0,255,136,0.12)"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, background: "rgba(0,255,136,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {step && totalSteps && totalSteps > 1
              ? <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "#00FF88" }}>{step}/{totalSteps}</span>
              : <Icon style={{ width: 12, height: 12, color: "#00FF88" }} />}
          </div>
          <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: "#E0F0FF" }}>{action.label}</span>
          {action.type !== "bridge" && (
            <span style={{
              fontFamily: MONO, fontSize: 10,
              color: action.type === "vote" ? "#FFB800" : "#3A5A6A",
              padding: "2px 6px", borderRadius: 4,
              background: action.type === "vote" ? "rgba(255,184,0,0.06)" : "rgba(0,255,136,0.04)",
              border: `1px solid ${action.type === "vote" ? "rgba(255,184,0,0.15)" : "rgba(0,255,136,0.08)"}`,
            }}>
              {action.type === "vote" ? "L1 GOV via ICosmos" : "AUTO-SIGN"}
            </span>
          )}
        </div>
        <p style={{ fontFamily: MONO, fontSize: 12, color: "#5A7A8A", margin: "0 0 12px", lineHeight: 1.5 }}>
          {action.description}
        </p>

        {status === "success" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 style={{ width: 14, height: 14, color: "#00FF88" }} />
            <span style={{ fontFamily: MONO, fontSize: 12, color: "#00FF88" }}>Transaction confirmed</span>
            {hash && (
              <a href={`https://scan.testnet.initia.xyz/initiation-2/txs/${hash}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: MONO, fontSize: 11, color: "#5A7A8A", textDecoration: "underline" }}>
                {hash.slice(0, 8)}...
              </a>
            )}
          </div>
        ) : status === "error" ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <XCircle style={{ width: 14, height: 14, color: "#FF3C3C" }} />
              <span style={{ fontFamily: MONO, fontSize: 12, color: "#FF3C3C" }}>Failed</span>
            </div>
            {error && <p style={{ fontFamily: MONO, fontSize: 11, color: "#5A4A4A", margin: 0, wordBreak: "break-word" }}>
              {error.length > 120 ? error.slice(0, 120) + "..." : error}
            </p>}
          </div>
        ) : (
          <button
            onClick={() => action.type === "bridge" ? onBridge() : onExecute(action, actionKey)}
            disabled={isExecuting}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 16px", borderRadius: 6,
              background: isExecuting ? "rgba(0,255,136,0.04)" : "rgba(0,255,136,0.1)",
              border: "1px solid rgba(0,255,136,0.2)",
              cursor: isExecuting ? "wait" : "pointer",
              fontFamily: MONO, fontSize: 12, fontWeight: 600, color: "#00FF88",
              transition: "all 0.15s",
            }}
          >
            {isExecuting ? (
              <><Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
              {status === "signing" ? "Preparing transaction..." : "Broadcasting..."}</>
            ) : !connected ? (
              <><Zap style={{ width: 13, height: 13 }} /> Connect Wallet to Execute</>
            ) : (
              <><Zap style={{ width: 13, height: 13 }} /> {action.type === "bridge" ? "Open Bridge" : "Execute"}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Export ──────────────────────────────────────────────────────────────────

export default function AskPulsePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#5A7A8A", fontFamily: MONO, fontSize: 13 }}>Loading…</div>}>
      <AskPulsePageInner />
    </Suspense>
  );
}
