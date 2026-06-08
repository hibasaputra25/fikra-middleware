"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { chatAPI, quizAPI } from "@/lib/api";
import { ArrowUp, BookOpen, Lightbulb, Target, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Quiz {
  id: number;
  nama: string;
}

const suggestions = [
  {
    icon: Lightbulb,
    text: "Jelaskan konsep penalaran umum dengan contoh sederhana",
  },
  {
    icon: Target,
    text: "Bagaimana strategi mengerjakan soal kuantitatif yang efisien?",
  },
  {
    icon: BookOpen,
    text: "Buatkan rencana belajar SNBT untuk 4 minggu ke depan",
  },
];

export default function ChatPage() {
  const { user } = useAuthStore();
  const {
    messages,
    isLoading,
    selectedQuizId,
    addMessage,
    setLoading,
    setSelectedQuiz,
    clearMessages,
  } = useChatStore();
  const [input, setInput] = useState("");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    loadQuizzes();
  }, []);

  useEffect(() => {
    if (hasMessages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, hasMessages]);

  // Auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  const loadQuizzes = async () => {
    try {
      const res = await quizAPI.getAll();
      setQuizzes(res.data.data || []);
    } catch (err) {
      console.error("Failed to load quizzes:", err);
    }
  };

  const send = async (text: string) => {
    const userMessage = text.trim();
    if (!userMessage || isLoading || !user) return;

    setInput("");
    addMessage("user", userMessage);
    setLoading(true);

    try {
      const chatMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMessage },
      ];
      const res = await chatAPI.send(user.id, selectedQuizId, chatMessages);
      addMessage("assistant", res.data.content);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      addMessage(
        "assistant",
        axiosErr.response?.data?.error || "Maaf, Kak Fikra lagi error. Coba lagi ya!"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-bg-page">
      {/* Header */}
      <div className="border-b border-border bg-bg-card/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">KF</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary leading-tight">Kak Fikra</p>
              <p className="text-xs text-text-muted leading-tight">Tutor AI SNBT</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasMessages && (
              <button
                onClick={clearMessages}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary px-2.5 py-1.5 rounded-lg hover:bg-ink/[0.04] transition-colors"
                title="Mulai obrolan baru"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Obrolan baru</span>
              </button>
            )}
            <select
              value={selectedQuizId || ""}
              onChange={(e) => setSelectedQuiz(e.target.value ? Number(e.target.value) : null)}
              className="text-xs border border-border rounded-lg px-2.5 py-1.5 text-text-secondary bg-bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 max-w-[140px] sm:max-w-none"
              aria-label="Pilih konteks tryout"
            >
              <option value="">Tanpa konteks</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.nama}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Conversation / Empty state */}
      {hasMessages ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-7">
            {messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-primary text-white text-[15px] leading-relaxed whitespace-pre-line">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-white text-[10px] font-bold">KF</span>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-xs font-semibold text-text-secondary mb-1.5">Kak Fikra</p>
                    <div className="fk-prose text-[15px] leading-[1.7] text-text-primary whitespace-pre-line">
                      {msg.content}
                    </div>
                  </div>
                </div>
              )
            )}

            {isLoading && (
              <div className="flex gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-white text-[10px] font-bold">KF</span>
                </div>
                <div className="flex items-center gap-1.5 pt-3">
                  <span className="w-2 h-2 bg-text-muted/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-text-muted/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-text-muted/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 min-h-full flex flex-col items-center justify-center text-center py-12">
            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mb-5 shadow-sm">
              <span className="text-white font-bold">KF</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
              Halo{user?.nama ? `, ${user.nama.split(" ")[0]}` : ""}. Ada yang bisa Kak Fikra bantu?
            </h1>
            <p className="mt-3 text-text-secondary max-w-md">
              Tanya soal yang bikin pusing, minta strategi belajar, atau pilih
              tryout di atas biar jawabannya lebih nyambung.
            </p>

            <div className="mt-8 w-full grid gap-2.5">
              {suggestions.map((s) => (
                <button
                  key={s.text}
                  onClick={() => send(s.text)}
                  className="group flex items-center gap-3 text-left px-4 py-3.5 rounded-xl border border-border bg-bg-card hover:border-primary/40 hover:bg-primary-light/40 transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <s.icon className="w-4 h-4 text-primary" />
                  </span>
                  <span className="text-sm text-text-primary">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="bg-bg-page">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-5 pt-2">
          <div className="relative flex items-end gap-2 bg-bg-card border border-border rounded-2xl shadow-[0_4px_24px_-12px_rgba(13,27,22,0.18)] p-2 pl-4 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tanya apa aja ke Kak Fikra..."
              rows={1}
              className="flex-1 resize-none bg-transparent py-2.5 text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none max-h-[200px] leading-relaxed"
              aria-label="Ketik pesan"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || isLoading}
              className={cn(
                "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                input.trim() && !isLoading
                  ? "bg-primary text-white hover:bg-primary-hover"
                  : "bg-border-light text-text-muted cursor-not-allowed"
              )}
              aria-label="Kirim pesan"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-xs text-text-muted mt-2.5">
            Kak Fikra bisa keliru. Selalu cek ulang jawaban penting.
          </p>
        </div>
      </div>
    </div>
  );
}
