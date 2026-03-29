"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Sparkles,
  ArrowLeftRight,
  Zap,
  TrendingUp,
  Shield,
  BarChart3,
  Activity,
} from "lucide-react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useEcosystem } from "@/hooks/use-ecosystem";
import { useNetwork } from "@/contexts/network-context";
import { scoreColor } from "@/lib/pulse-score";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

/** Lightweight markdown renderer for AI responses — handles **bold**, line breaks */
function renderMarkdown(text: string) {
  // Split into paragraphs on double newlines
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map((para, pi) => {
    // Process inline bold **text**
    const parts = para.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} style={{ color: "#E0F0FF", fontWeight: 600 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      // Handle single line breaks within paragraph
      return part.split("\n").map((line, li, arr) => (
        <span key={`${i}-${li}`}>
          {line}
          {li < arr.length - 1 && <br />}
        </span>
      ));
    });
    return (
      <p key={pi} style={{ margin: pi > 0 ? "10px 0 0" : 0 }}>
        {rendered}
      </p>
    );
  });
}

const CATEGORIES = [
  {
    icon: Activity,
    label: "Ecosystem",
    questions: [
      "Give me a full ecosystem health report",
      "Which minitia is the most active right now?",
      "Are there any anomalies across the network?",
    ],
  },
  {
    icon: TrendingUp,
    label: "Staking",
    questions: [
      "Best validators to stake with for a balanced portfolio?",
      "Which validators have the lowest commission?",
      "Should I stake or provide LP right now?",
    ],
  },
  {
    icon: ArrowLeftRight,
    label: "Bridge",
    questions: [
      "How do I bridge INIT to the Pulse rollup?",
      "What's the fastest bridge path between minitias?",
      "Show me active bridge channels and their status",
    ],
  },
  {
    icon: Shield,
    label: "Security",
    questions: [
      "Which minitias have oracle-enabled bridges?",
      "What's the finalization period for OPinit bridges?",
      "Any validator centralization concerns?",
    ],
  },
  {
    icon: Zap,
    label: "Deploy",
    questions: [
      "Where should I deploy a DeFi app on Initia?",
      "Compare minitia block times and throughput",
      "Which rollups support Celestia DA?",
    ],
  },
  {
    icon: BarChart3,
    label: "Data",
    questions: [
      "Total transactions across all minitias",
      "IBC channel activity summary",
      "How many validators are active on L1?",
    ],
  },
];

export default function AskPulsePage() {
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { openBridge } = useInterwovenKit();
  const { data: ecosystem } = useEcosystem();
  const { network } = useNetwork();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(
    async (msg?: string) => {
      const text = (msg ?? input).trim();
      if (!text || loading) return;
      setInput("");
      const userMsg: ChatMsg = { role: "user", content: text, timestamp: Date.now() };
      const newChat = [...chat, userMsg];
      setChat(newChat);
      setLoading(true);

      // Reset textarea height
      if (inputRef.current) inputRef.current.style.height = "44px";

      try {
        const res = await fetch("/api/insights/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: chat.map((m) => ({ role: m.role, content: m.content })),
            mode: "full",
            network,
          }),
        });
        const json = await res.json();
        const response = json.response || json.error;
        setChat([
          ...newChat,
          { role: "assistant", content: response, timestamp: Date.now() },
        ]);
      } catch {
        setChat([
          ...newChat,
          {
            role: "assistant",
            content: "Connection error. The ecosystem data feed may be temporarily unavailable.",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [chat, input, loading, network]
  );

  function handleBridge() {
    openBridge({ srcChainId: "initiation-2", srcDenom: "uinit" });
  }

  const lastMsg = chat.length > 0 ? chat[chat.length - 1] : null;
  const showBridgeAction =
    lastMsg?.role === "assistant" && /bridge|transfer|move.*init/i.test(lastMsg.content);

  const hasMessages = chat.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Background ambient effect */}
        <div
          style={{
            position: "fixed",
            top: 60,
            left: "50%",
            transform: "translateX(-50%)",
            width: 800,
            height: 600,
            background:
              "radial-gradient(ellipse, rgba(0,255,136,0.03) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Main content area */}
        <div
          style={{
            flex: 1,
            maxWidth: 820,
            width: "100%",
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            zIndex: 1,
          }}
        >
        {/* Empty state — hero + categories */}
        {!hasMessages && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "center",
              paddingTop: 40,
              paddingBottom: 140,
              overflowY: "auto",
              animation: "fade-in 0.6s ease-out",
            }}
          >
            {/* Hero */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                marginBottom: 48,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: "rgba(0,255,136,0.06)",
                  border: "1px solid rgba(0,255,136,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 40px rgba(0,255,136,0.08)",
                }}
              >
                <Sparkles style={{ width: 28, height: 28, color: "#00FF88" }} />
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-chakra), sans-serif",
                  fontSize: 36,
                  fontWeight: 700,
                  color: "#E0F0FF",
                  margin: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                Ask Pulse
              </h1>
              <p
                style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 13,
                  color: "#8AB4C8",
                  margin: 0,
                  textAlign: "center",
                  lineHeight: 1.6,
                  maxWidth: 440,
                }}
              >
                AI-powered intelligence with live ecosystem data.
                <br />
                Ask anything about Initia — staking, bridging, deploying, or monitoring.
              </p>

              {/* Live data indicator */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 14px",
                  border: "1px solid rgba(0,255,136,0.1)",
                  borderRadius: 20,
                  background: "rgba(0,255,136,0.03)",
                  marginTop: 4,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#00FF88",
                    boxShadow: "0 0 8px #00FF88",
                    animation: "pulse-glow-green 2s infinite",
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: 12,
                    color: "#00FF88",
                    letterSpacing: "0.08em",
                  }}
                >
                  Connected to live ecosystem feed
                </span>
              </div>

              {/* Live Pulse Scores summary */}
              {ecosystem?.minitias && (() => {
                const scored = ecosystem.minitias
                  .filter(m => m.pulseScore && (m.metrics?.blockHeight ?? 0) > 0)
                  .sort((a, b) => (b.pulseScore?.total ?? 0) - (a.pulseScore?.total ?? 0))
                  .slice(0, 5);
                if (!scored.length) return null;
                return (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "8px 16px",
                    border: "1px solid rgba(255,255,255,0.04)",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.01)",
                    marginTop: 4,
                  }}>
                    <span style={{
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: 11, color: "#3A5A6A",
                      letterSpacing: "0.1em",
                    }}>
                      PULSE SCORES
                    </span>
                    {scored.map(m => (
                      <div key={m.chainId} style={{
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        <span style={{
                          fontFamily: "var(--font-jetbrains), monospace",
                          fontSize: 12, color: "#5A7A8A",
                        }}>
                          {m.prettyName}
                        </span>
                        <span style={{
                          fontFamily: "var(--font-jetbrains), monospace",
                          fontSize: 14, fontWeight: 700,
                          color: scoreColor(m.pulseScore?.total ?? 0),
                        }}>
                          {m.pulseScore?.total}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Category grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                width: "100%",
                maxWidth: 700,
              }}
            >
              {CATEGORIES.map((cat) => (
                <CategoryCard
                  key={cat.label}
                  icon={cat.icon}
                  label={cat.label}
                  questions={cat.questions}
                  onSelect={sendMessage}
                />
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {hasMessages && (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              paddingTop: 16,
              paddingBottom: 140,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {/* Chat header with title + new chat */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 0", borderBottom: "1px solid rgba(0,255,136,0.06)",
              marginBottom: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles style={{ width: 14, height: 14, color: "#00FF88" }} />
                <span style={{
                  fontFamily: "var(--font-chakra), sans-serif",
                  fontSize: 15, fontWeight: 700, color: "#E0F0FF",
                }}>Ask Pulse</span>
                <span style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11, color: "#3A5A6A",
                }}>{chat.filter(m => m.role === "user").length} messages</span>
              </div>
              <button
                onClick={() => setChat([])}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 12px", borderRadius: 4,
                  border: "1px solid rgba(0,255,136,0.1)",
                  background: "rgba(0,255,136,0.03)",
                  cursor: "pointer",
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11, color: "#5A7A8A",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,255,136,0.25)"; e.currentTarget.style.color = "#00FF88"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,255,136,0.1)"; e.currentTarget.style.color = "#5A7A8A"; }}
              >
                New chat
              </button>
            </div>

            {chat.map((m, i) => (
              <MessageBubble key={i} msg={m} />
            ))}

            {/* Bridge action */}
            {showBridgeAction && (
              <div style={{ display: "flex", paddingLeft: 44 }}>
                <button
                  onClick={handleBridge}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 18px",
                    borderRadius: 8,
                    background: "rgba(0,255,136,0.06)",
                    border: "1px solid rgba(0,255,136,0.2)",
                    cursor: "pointer",
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: 12,
                    color: "#00FF88",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(0,255,136,0.12)";
                    e.currentTarget.style.borderColor = "rgba(0,255,136,0.35)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(0,255,136,0.06)";
                    e.currentTarget.style.borderColor = "rgba(0,255,136,0.2)";
                  }}
                >
                  <ArrowLeftRight style={{ width: 14, height: 14 }} />
                  Open Bridge — Transfer INIT
                </button>
              </div>
            )}

            {/* Loading indicator */}
            {loading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  paddingLeft: 0,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "rgba(0,255,136,0.06)",
                    border: "1px solid rgba(0,255,136,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Sparkles style={{ width: 14, height: 14, color: "#00FF88" }} />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 0",
                  }}
                >
                  <Loader2
                    style={{ width: 14, height: 14, color: "#00FF88" }}
                    className="animate-spin"
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: 12,
                      color: "#5A7A8A",
                    }}
                  >
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

      {/* Input bar — fixed at bottom */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          background:
            "linear-gradient(to top, rgba(4,10,15,1) 60%, rgba(4,10,15,0))",
          padding: "32px 24px 24px",
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          style={{
            maxWidth: 820,
            margin: "0 auto",
            display: "flex",
            alignItems: "flex-end",
            gap: 12,
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid rgba(0,255,136,0.12)",
            background: "rgba(10,18,24,0.95)",
            backdropFilter: "blur(24px)",
            boxShadow:
              "0 -4px 32px rgba(0,0,0,0.4), 0 0 60px rgba(0,255,136,0.03)",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLFormElement).style.borderColor =
              "rgba(0,255,136,0.25)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLFormElement).style.borderColor =
              "rgba(0,255,136,0.12)";
          }}
        >
          <Sparkles
            style={{
              width: 16,
              height: 16,
              color: "#00FF88",
              opacity: 0.5,
              flexShrink: 0,
              marginBottom: 4,
            }}
          />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize
              e.target.style.height = "44px";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask about the Initia ecosystem..."
            disabled={loading}
            rows={1}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 13,
              color: "#8AB4C8",
              outline: "none",
              resize: "none",
              height: 44,
              lineHeight: "22px",
              padding: "11px 0",
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "none",
              background:
                input.trim() && !loading
                  ? "rgba(0,255,136,0.15)"
                  : "rgba(0,255,136,0.04)",
              cursor: input.trim() && !loading ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (input.trim() && !loading)
                e.currentTarget.style.background = "rgba(0,255,136,0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                input.trim() && !loading
                  ? "rgba(0,255,136,0.15)"
                  : "rgba(0,255,136,0.04)";
            }}
          >
            <Send
              style={{
                width: 15,
                height: 15,
                color: input.trim() && !loading ? "#00FF88" : "#3A5A6A",
              }}
            />
          </button>
        </form>
        <p
          style={{
            textAlign: "center",
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 11,
            color: "#3A5A6A",
            marginTop: 8,
          }}
        >
          Pulse AI analyzes live on-chain data from {ecosystem?.minitias?.filter(m => (m.metrics?.blockHeight ?? 0) > 0).length ?? "—"} rollups in real-time
        </p>
      </div>
    </div>
  );
}

/* ─── Category Card ─────────────────────────────────────────────────────────── */

function CategoryCard({
  icon: Icon,
  label,
  questions,
  onSelect,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { style?: React.CSSProperties }>;
  label: string;
  questions: string[];
  onSelect: (q: string) => void;
}) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid rgba(0,255,136,0.08)",
        background: "rgba(10,18,24,0.6)",
        padding: 14,
        transition: "all 0.2s",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(0,255,136,0.2)";
        e.currentTarget.style.background = "rgba(0,255,136,0.04)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(0,255,136,0.08)";
        e.currentTarget.style.background = "rgba(10,18,24,0.6)";
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <Icon
          style={{
            width: 14,
            height: 14,
            color: "#5A7A8A",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-chakra), sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: "#8AB4C8",
          }}
        >
          {label}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {questions.map((q) => (
          <button
            key={q}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(q);
            }}
            style={{
              textAlign: "left",
              padding: "6px 8px",
              borderRadius: 4,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 12,
              color: "#5A7A8A",
              lineHeight: 1.4,
              transition: "all 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,255,136,0.06)";
              e.currentTarget.style.color = "#00FF88";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#5A7A8A";
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Message Bubble ────────────────────────────────────────────────────────── */

function MessageBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  const time = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isUser) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            maxWidth: "75%",
            padding: "12px 16px",
            borderRadius: "12px 12px 4px 12px",
            background: "rgba(0,255,136,0.06)",
            border: "1px solid rgba(0,255,136,0.15)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 13,
              color: "#8AB4C8",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}
          >
            {msg.content}
          </p>
          <span
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 11,
              color: "#3A5A6A",
              display: "block",
              marginTop: 6,
              textAlign: "right",
            }}
          >
            {time}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "rgba(0,255,136,0.06)",
          border: "1px solid rgba(0,255,136,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        <Sparkles style={{ width: 14, height: 14, color: "#00FF88" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-chakra), sans-serif",
              fontSize: 12,
              fontWeight: 600,
              color: "#00FF88",
            }}
          >
            Pulse AI
          </span>
          <span
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 11,
              color: "#3A5A6A",
            }}
          >
            {time}
          </span>
        </div>
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "4px 12px 12px 12px",
            background: "rgba(10,18,24,0.8)",
            border: "1px solid rgba(0,255,136,0.06)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-jetbrains), monospace",
              fontSize: 12,
              color: "#8AB4C8",
              lineHeight: 1.8,
              wordBreak: "break-word",
            }}
          >
            {renderMarkdown(msg.content)}
          </div>
        </div>
      </div>
    </div>
  );
}
