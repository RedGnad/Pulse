"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, MessageSquare, X, Sparkles, ArrowLeftRight } from "lucide-react";
import { useInterwovenKit } from "@initia/interwovenkit-react";

interface ChatMsg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "Which minitia is most active?",
  "Should I stake or provide LP?",
  "Bridge INIT to Pulse rollup",
  "Ecosystem health report",
];

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { openBridge } = useInterwovenKit();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function sendMessage(msg?: string) {
    const text = (msg ?? input).trim();
    if (!text || loading) return;
    setInput("");
    const newChat: ChatMsg[] = [...chat, { role: "user", content: text }];
    setChat(newChat);
    setLoading(true);
    try {
      const res = await fetch("/api/insights/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: chat }),
      });
      const json = await res.json();
      const response = json.response || json.error;
      setChat([...newChat, { role: "assistant", content: response }]);
    } catch {
      setChat([...newChat, { role: "assistant", content: "Connection error. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleBridge() {
    openBridge({ srcChainId: "initiation-2", srcDenom: "uinit" });
  }

  const lastMsg = chat.length > 0 ? chat[chat.length - 1] : null;
  const showBridgeAction = lastMsg?.role === "assistant" &&
    /bridge|transfer|move.*init/i.test(lastMsg.content);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          width: 52, height: 52, borderRadius: 12,
          background: open ? "rgba(0,255,136,0.1)" : "linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,255,136,0.05))",
          border: `1px solid ${open ? "rgba(0,255,136,0.25)" : "rgba(0,255,136,0.15)"}`,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4), 0 0 40px rgba(0,255,136,0.06)",
          transition: "all 0.2s",
        }}
      >
        {open
          ? <X style={{ width: 20, height: 20, color: "#00FF88" }} />
          : <MessageSquare style={{ width: 20, height: 20, color: "#00FF88" }} />
        }
        {!open && chat.length === 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            width: 12, height: 12, borderRadius: "50%",
            background: "#00FF88",
            boxShadow: "0 0 8px #00FF88",
            animation: "pulse-glow-green 2s infinite",
          }} />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 88, right: 24, zIndex: 9998,
          width: 400, maxHeight: "70vh",
          borderRadius: 8, overflow: "hidden",
          border: "1px solid rgba(0,255,136,0.1)",
          background: "rgba(4,10,15,0.97)",
          backdropFilter: "blur(24px)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.6), 0 0 60px rgba(0,255,136,0.03)",
          display: "flex", flexDirection: "column",
          animation: "chat-slide-up 0.2s ease-out",
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 18px",
            borderBottom: "1px solid rgba(0,255,136,0.06)",
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(0,255,136,0.02)",
          }}>
            <Sparkles style={{ width: 14, height: 14, color: "#00FF88" }} />
            <div>
              <span style={{
                fontFamily: "var(--font-chakra), sans-serif",
                fontSize: 13, fontWeight: 600, color: "#E0F0FF",
              }}>
                Pulse AI
              </span>
              <span style={{
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: 9, color: "#1E3040", marginLeft: 8,
                letterSpacing: "0.1em",
              }}>
                Live ecosystem context
              </span>
            </div>
            <div style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#00FF88", boxShadow: "0 0 6px #00FF88",
              }} />
              <span style={{
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: 9, color: "#00FF88",
              }}>
                Online
              </span>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, padding: 14, overflowY: "auto",
            minHeight: 240, maxHeight: "calc(70vh - 130px)",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {chat.length === 0 && (
              <div style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                flex: 1, gap: 12, padding: "20px 0",
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "rgba(0,255,136,0.06)",
                  border: "1px solid rgba(0,255,136,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Sparkles style={{ width: 18, height: 18, color: "#00FF88" }} />
                </div>
                <p style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11, color: "#3A5A6A", textAlign: "center",
                  lineHeight: 1.5,
                }}>
                  Ask about the ecosystem, get staking advice,<br />
                  or bridge assets — all with live data.
                </p>
                <div style={{
                  display: "flex", flexWrap: "wrap", gap: 6,
                  justifyContent: "center", maxWidth: 340,
                }}>
                  {SUGGESTIONS.map(q => (
                    <button key={q} onClick={() => sendMessage(q)} style={{
                      padding: "5px 10px",
                      border: "1px solid rgba(0,255,136,0.08)",
                      borderRadius: 4,
                      background: "rgba(0,255,136,0.03)",
                      cursor: "pointer",
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: 10, color: "#5A7A8A",
                      transition: "all 0.15s",
                    }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = "rgba(0,255,136,0.25)";
                        e.currentTarget.style.color = "#00FF88";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = "rgba(0,255,136,0.08)";
                        e.currentTarget.style.color = "#5A7A8A";
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chat.map((m, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "85%", padding: "8px 12px", borderRadius: 6,
                  background: m.role === "user"
                    ? "rgba(0,255,136,0.06)"
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${m.role === "user"
                    ? "rgba(0,255,136,0.15)"
                    : "rgba(255,255,255,0.04)"}`,
                }}>
                  {m.role === "assistant" && (
                    <span style={{
                      fontFamily: "var(--font-jetbrains), monospace",
                      fontSize: 8, letterSpacing: "0.15em",
                      textTransform: "uppercase" as const,
                      color: "#00FF88", display: "block", marginBottom: 4,
                    }}>
                      Pulse AI
                    </span>
                  )}
                  <p style={{
                    margin: 0,
                    fontFamily: "var(--font-jetbrains), monospace",
                    fontSize: 11, color: m.role === "user" ? "#8AB4C8" : "#5A7A8A",
                    lineHeight: 1.6, whiteSpace: "pre-wrap",
                  }}>
                    {m.content}
                  </p>
                </div>
              </div>
            ))}

            {/* Bridge action button when AI mentions bridging */}
            {showBridgeAction && (
              <div style={{
                display: "flex", justifyContent: "flex-start",
              }}>
                <button onClick={handleBridge} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 6,
                  background: "rgba(0,255,136,0.06)",
                  border: "1px solid rgba(0,255,136,0.15)",
                  cursor: "pointer",
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 11, color: "#00FF88",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(0,255,136,0.12)";
                    e.currentTarget.style.borderColor = "rgba(0,255,136,0.3)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(0,255,136,0.06)";
                    e.currentTarget.style.borderColor = "rgba(0,255,136,0.15)";
                  }}
                >
                  <ArrowLeftRight style={{ width: 12, height: 12 }} />
                  Open Bridge — Transfer INIT
                </button>
              </div>
            )}

            {loading && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px",
              }}>
                <Loader2 style={{ width: 12, height: 12, color: "#00FF88" }} className="animate-spin" />
                <span style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 10, color: "#1E3040",
                }}>
                  Analyzing with live data…
                </span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} style={{
            display: "flex",
            borderTop: "1px solid rgba(0,255,136,0.06)",
            background: "rgba(0,255,136,0.01)",
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about Initia ecosystem…"
              disabled={loading}
              style={{
                flex: 1, padding: "12px 16px",
                border: "none", background: "transparent",
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: 12, color: "#8AB4C8",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              style={{
                padding: "0 16px", border: "none",
                borderLeft: "1px solid rgba(0,255,136,0.06)",
                background: "transparent", cursor: "pointer",
                opacity: (!input.trim() || loading) ? 0.3 : 1,
                transition: "opacity 0.15s",
              }}
            >
              <Send style={{ width: 14, height: 14, color: "#00FF88" }} />
            </button>
          </form>
        </div>
      )}

      <style jsx global>{`
        @keyframes chat-slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
