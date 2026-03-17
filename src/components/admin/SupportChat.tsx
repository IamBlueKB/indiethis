"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Loader2, Bot, User } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "How many studios signed up this week?",
  "Which AI tool is most used?",
  "How many users haven't logged in this month?",
  "What's the current MRR?",
];

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Hi! I'm your IndieThis platform assistant. Ask me anything about your users, studios, revenue, or AI usage. I have live access to platform stats.",
      }]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    setInput("");
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    try {
      const history = [...messages.filter((m) => m.id !== "welcome"), userMsg];
      const res = await fetch("/api/admin/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      const reply = data.reply ?? "Sorry, I couldn't get a response.";

      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: reply },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg, #E85D4A, #D4A843)" }}
          aria-label="Open admin assistant"
        >
          <MessageSquare size={20} className="text-white" strokeWidth={2} />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: 380,
            height: 520,
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{
              borderColor: "var(--border)",
              background: "linear-gradient(135deg, rgba(232,93,74,0.08), rgba(212,168,67,0.08))",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #E85D4A, #D4A843)" }}
              >
                <Bot size={14} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Platform Assistant</p>
                <p className="text-[10px] text-muted-foreground">Live platform data</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    backgroundColor: msg.role === "assistant"
                      ? "rgba(232,93,74,0.15)"
                      : "rgba(255,255,255,0.1)",
                  }}
                >
                  {msg.role === "assistant"
                    ? <Bot size={12} style={{ color: "#E85D4A" }} />
                    : <User size={12} className="text-muted-foreground" />
                  }
                </div>

                {/* Bubble */}
                <div
                  className="rounded-2xl px-3 py-2 text-sm max-w-[78%] leading-relaxed"
                  style={
                    msg.role === "assistant"
                      ? { backgroundColor: "rgba(255,255,255,0.05)", color: "var(--foreground)" }
                      : { background: "linear-gradient(135deg, #E85D4A, #D4A843)", color: "#fff" }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(232,93,74,0.15)" }}>
                  <Bot size={12} style={{ color: "#E85D4A" }} />
                </div>
                <div className="rounded-2xl px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                  <Loader2 size={14} className="animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Suggestions (only when just welcome message) */}
          {messages.length === 1 && !loading && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full border transition-colors hover:bg-white/5"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div
            className="flex items-center gap-2 px-3 py-3 border-t shrink-0"
            style={{ borderColor: "var(--border)" }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about the platform…"
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30 hover:scale-105"
              style={{ background: "linear-gradient(135deg, #E85D4A, #D4A843)" }}
            >
              {loading ? (
                <Loader2 size={13} className="text-white animate-spin" />
              ) : (
                <Send size={13} className="text-white" />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
