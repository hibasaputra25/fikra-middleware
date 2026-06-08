"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { chatAPI, quizAPI } from "@/lib/api";
import Container from "@/components/layout/Container";
import Button from "@/components/ui/Button";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Quiz {
  id: number;
  nama: string;
}

export default function ChatPage() {
  const { user } = useAuthStore();
  const { messages, isLoading, selectedQuizId, addMessage, setLoading, setSelectedQuiz } = useChatStore();
  const [input, setInput] = useState("");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadQuizzes();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadQuizzes = async () => {
    try {
      const res = await quizAPI.getAll();
      setQuizzes(res.data.data || []);
    } catch (err) {
      console.error("Failed to load quizzes:", err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !user) return;

    const userMessage = input.trim();
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
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Chat Header */}
      <div className="border-b border-border bg-bg-card px-4 sm:px-6 py-3">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">KF</span>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Kak Fikra</p>
              <p className="text-xs text-text-muted">AI Tutor SNBT</p>
            </div>
          </div>
          <select
            value={selectedQuizId || ""}
            onChange={(e) => setSelectedQuiz(e.target.value ? Number(e.target.value) : null)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 text-text-secondary bg-bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Pilih konteks tryout"
          >
            <option value="">Tanpa konteks</option>
            {quizzes.map((q) => (
              <option key={q.id} value={q.id}>{q.nama}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-primary font-bold">KF</span>
              </div>
              <h2 className="text-base font-medium text-text-primary mb-1">
                Halo! Kak Fikra di sini.
              </h2>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                Tanya apa aja soal persiapan SNBT kamu. Pilih tryout di atas biar Kak Fikra bisa kasih saran yang lebih spesifik.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-md"
                    : "bg-gray-100 text-text-primary rounded-bl-md"
                )}
              >
                <p className="whitespace-pre-line">{msg.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-bg-card px-4 sm:px-6 py-3">
        <div className="max-w-[1200px] mx-auto flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pesan..."
            rows={1}
            className="flex-1 resize-none px-4 py-2.5 border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary max-h-32"
            style={{ minHeight: "42px" }}
            aria-label="Ketik pesan"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="md"
            className="shrink-0 px-3"
            aria-label="Kirim pesan"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}