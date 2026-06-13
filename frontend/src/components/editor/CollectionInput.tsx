"use client";

import { useEffect, useRef, useState } from "react";
import { collectionAPI, type QuestionCollection } from "@/lib/api";
import { X, Plus, FolderOpen } from "lucide-react";

interface CollectionInputProps {
  value: Array<{ id?: number; name?: string }>;
  onChange: (collections: Array<{ id?: number; name?: string }>) => void;
}

export default function CollectionInput({ value, onChange }: CollectionInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<QuestionCollection[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const fetcher = input.trim()
        ? collectionAPI.search(input)
        : collectionAPI.getAll();
      fetcher
        .then((res) => {
          const selected = new Set(value.map((v) => v.name?.toLowerCase()).filter(Boolean));
          setSuggestions(res.data.data.filter((c) => !selected.has(c.name.toLowerCase())));
        })
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [input, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addCollection = (item: { id?: number; name: string }) => {
    const name = item.name.trim();
    if (!name) return;
    const exists = value.some((v) => v.name?.toLowerCase() === name.toLowerCase());
    if (exists) {
      setInput("");
      return;
    }
    onChange([...value, { id: item.id, name }]);
    setInput("");
    setShowSuggestions(false);
  };

  const removeCollection = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (input.trim()) {
        addCollection({ name: input });
      }
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeCollection(value.length - 1);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border border-border rounded-xl bg-bg-card focus-within:ring-4 focus-within:ring-admin-accent/10 focus-within:border-admin-accent/50 transition-all">
        {value.map((c, idx) => (
          <span
            key={`${c.id || c.name}-${idx}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-secondary/10 text-secondary rounded-lg text-xs font-medium"
          >
            <FolderOpen className="w-3 h-3" />
            {c.name}
            <button
              type="button"
              onClick={() => removeCollection(idx)}
              className="hover:bg-secondary/20 rounded p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? "Pilih atau buat kategori..." : ""}
          className="flex-1 min-w-[140px] py-0.5 text-sm bg-transparent focus:outline-none"
        />
      </div>

      {showSuggestions && (suggestions.length > 0 || input.trim()) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-xl shadow-lg overflow-hidden z-10 max-h-72 overflow-y-auto">
          {suggestions.length === 0 && !input.trim() && (
            <div className="px-3 py-2 text-sm text-text-muted">
              Belum ada kategori. Ketik nama untuk membuat baru.
            </div>
          )}
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => addCollection({ id: s.id, name: s.name })}
              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
            >
              <FolderOpen className="w-3.5 h-3.5 text-secondary shrink-0" />
              <span className="flex-1 text-sm text-text-primary truncate">{s.name}</span>
              {s.question_count !== undefined && s.question_count > 0 && (
                <span className="text-xs text-text-muted shrink-0">
                  {s.question_count} soal
                </span>
              )}
            </button>
          ))}
          {input.trim() &&
            !suggestions.some((s) => s.name.toLowerCase() === input.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => addCollection({ name: input })}
                className="w-full px-3 py-2 text-left bg-gray-50/50 hover:bg-gray-100 flex items-center gap-2 border-t border-border-light"
              >
                <Plus className="w-3.5 h-3.5 text-admin-accent" />
                <span className="text-sm text-text-primary">
                  Buat kategori baru:{" "}
                  <span className="font-medium">&ldquo;{input}&rdquo;</span>
                </span>
              </button>
            )}
        </div>
      )}
    </div>
  );
}
