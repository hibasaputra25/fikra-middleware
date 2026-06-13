"use client";

import { useEffect, useRef, useState } from "react";
import { tagAPI, type Tag } from "@/lib/api";
import { X, Plus } from "lucide-react";

interface TagInputProps {
  value: Array<{ id?: number; name?: string }>;
  onChange: (tags: Array<{ id?: number; name?: string }>) => void;
}

export default function TagInput({ value, onChange }: TagInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions saat input berubah
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      tagAPI
        .search(input)
        .then((res) => {
          // Filter yang sudah dipilih
          const selected = new Set(value.map((v) => v.name?.toLowerCase()).filter(Boolean));
          setSuggestions(res.data.data.filter((t) => !selected.has(t.name.toLowerCase())));
        })
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [input, value]);

  // Klik di luar tutup suggestions
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addTag = (tag: { id?: number; name: string }) => {
    const name = tag.name.trim();
    if (!name) return;
    // Cegah duplikat (case-insensitive)
    const exists = value.some((v) => v.name?.toLowerCase() === name.toLowerCase());
    if (exists) {
      setInput("");
      return;
    }
    onChange([...value, { id: tag.id, name }]);
    setInput("");
    setSuggestions([]);
  };

  const removeTag = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) {
        addTag({ name: input });
      }
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border border-border rounded-xl bg-bg-card focus-within:ring-4 focus-within:ring-admin-accent/10 focus-within:border-admin-accent/50 transition-all">
        {value.map((tag, idx) => (
          <span
            key={`${tag.id || tag.name}-${idx}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-admin-accent/10 text-admin-accent rounded-full text-xs font-medium"
          >
            {tag.name}
            <button
              type="button"
              onClick={() => removeTag(idx)}
              className="hover:bg-admin-accent/20 rounded-full p-0.5"
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
          placeholder={value.length === 0 ? "Ketik nama tag, lalu Enter..." : ""}
          className="flex-1 min-w-[100px] py-0.5 text-sm bg-transparent focus:outline-none"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (suggestions.length > 0 || input.trim()) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-xl shadow-lg overflow-hidden z-10 max-h-60 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => addTag({ id: s.id, name: s.name })}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
            >
              <span className="text-text-primary">{s.name}</span>
              {s.usage_count !== undefined && s.usage_count > 0 && (
                <span className="text-xs text-text-muted">{s.usage_count}×</span>
              )}
            </button>
          ))}
          {input.trim() && !suggestions.some((s) => s.name.toLowerCase() === input.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => addTag({ name: input })}
              className="w-full px-3 py-2 text-left text-sm bg-gray-50/50 hover:bg-gray-100 flex items-center gap-2 border-t border-border-light"
            >
              <Plus className="w-3.5 h-3.5 text-admin-accent" />
              <span className="text-text-primary">
                Buat tag baru: <span className="font-medium">&ldquo;{input}&rdquo;</span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
