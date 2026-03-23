"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User, RotateCcw, Sparkles } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How many active subscribers do we have?",
  "What's our estimated MRR this month?",
  "How many new signups this week?",
  "Are there any flagged studios needing review?",
  "How many cancellations happened this month?",
  "What AI tools are being used most?",
];

function fmt(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function SupportChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Message = { role: "user", content };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res  = await fetch("/api/admin/support-chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ messages: next }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      const reply = data.reply ?? data.error ?? "Something went wrong.";
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Network error. Please try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform AI</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ask anything about platform activity, users, revenue, or operations
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            style={{ borderColor: "var(--border)" }}
          >
            <RotateCcw size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Chat area */}
      <div
        className="flex-1 overflow-y-auto rounded-2xl border p-4 space-y-4"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
            {/* Icon */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(212,168,67,0.2), rgba(212,168,67,0.05))", border: "1px solid rgba(212,168,67,0.2)" }}
            >
              <Sparkles size={28} style={{ color: "#D4A843" }} />
            </div>
            <div className="text-center">
              <p className="text-foreground font-semibold text-base">Platform AI Assistant</p>
              <p className="text-muted-foreground text-sm mt-1">
                Knows your live stats — users, revenue, AI usage, churn, and more.
              </p>
            </div>

            {/* Suggestion chips */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="text-left px-3.5 py-2.5 rounded-xl border text-sm text-muted-foreground hover:text-foreground hover:border-[#D4A843]/40 transition-colors"
                  style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "var(--border)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: m.role === "assistant" ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.08)",
                  }}
                >
                  {m.role === "assistant"
                    ? <Bot size={15} style={{ color: "#D4A843" }} />
                    : <User size={15} className="text-muted-foreground" />
                  }
                </div>

                {/* Bubble */}
                <div
                  className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={
                    m.role === "assistant"
                      ? { backgroundColor: "rgba(255,255,255,0.05)", color: "var(--foreground)", border: "1px solid var(--border)" }
                      : { backgroundColor: "rgba(212,168,67,0.12)", color: "var(--foreground)", border: "1px solid rgba(212,168,67,0.25)" }
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgba(212,168,67,0.15)" }}
                >
                  <Bot size={15} style={{ color: "#D4A843" }} />
                </div>
                <div
                  className="px-4 py-3 rounded-2xl"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}
                >
                  <Loader2 size={15} className="animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="mt-3 flex items-end gap-3 rounded-2xl border px-4 py-3"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about platform stats, users, revenue…"
          rows={1}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none"
          style={{ maxHeight: "120px" }}
        />
        <button
          onClick={() => void send()}
          disabled={!input.trim() || loading}
          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>

      <p className="text-center text-[11px] text-muted-foreground mt-2">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
