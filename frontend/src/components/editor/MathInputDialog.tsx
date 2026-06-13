"use client";

import { useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import "mathlive";
import type { MathfieldElement } from "mathlive";
import { X, Calculator } from "lucide-react";
import Button from "@/components/ui/Button";

// Template ditampilkan sebagai rumus yang sudah di-render (KaTeX), bukan label teks
const TEMPLATES: { latex: string; insert: string }[] = [
  { latex: "\\frac{a}{b}", insert: "\\frac{#0}{#?}" },
  { latex: "\\sqrt{x}", insert: "\\sqrt{#0}" },
  { latex: "\\sqrt[n]{x}", insert: "\\sqrt[#?]{#0}" },
  { latex: "x^{n}", insert: "#0^{#?}" },
  { latex: "x_{n}", insert: "#0_{#?}" },
  { latex: "x^{2}", insert: "#0^{2}" },
  { latex: "\\sum_{i=1}^{n} x_i", insert: "\\sum_{#?=#?}^{#?} #0" },
  { latex: "\\prod_{i=1}^{n}", insert: "\\prod_{#?=#?}^{#?} #0" },
  { latex: "\\int_{a}^{b} f(x)\\,dx", insert: "\\int_{#?}^{#?} #0\\,d#?" },
  { latex: "\\lim_{x \\to \\infty}", insert: "\\lim_{#? \\to #?} #0" },
  { latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", insert: "\\begin{pmatrix} #0 & #? \\\\ #? & #? \\end{pmatrix}" },
  { latex: "\\begin{cases} a & x>0 \\\\ b & x<0 \\end{cases}", insert: "\\begin{cases} #0 & #? \\\\ #? & #? \\end{cases}" },
  { latex: "\\pi", insert: "\\pi" },
  { latex: "\\theta", insert: "\\theta" },
  { latex: "\\alpha", insert: "\\alpha" },
  { latex: "\\beta", insert: "\\beta" },
  { latex: "\\gamma", insert: "\\gamma" },
  { latex: "\\delta", insert: "\\delta" },
  { latex: "\\infty", insert: "\\infty" },
  { latex: "\\leq", insert: "\\leq" },
  { latex: "\\geq", insert: "\\geq" },
  { latex: "\\neq", insert: "\\neq" },
  { latex: "\\approx", insert: "\\approx" },
  { latex: "\\pm", insert: "\\pm" },
  { latex: "\\times", insert: "\\times" },
  { latex: "\\div", insert: "\\div" },
  { latex: "\\cdot", insert: "\\cdot" },
];

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          value?: string;
          ref?: React.Ref<MathfieldElement>;
        },
        HTMLElement
      >;
    }
  }
}

interface MathInputDialogProps {
  open: boolean;
  initialLatex?: string;
  onClose: () => void;
  onConfirm: (latex: string, displayMode: boolean) => void;
}

export default function MathInputDialog({
  open,
  initialLatex = "",
  onClose,
  onConfirm,
}: MathInputDialogProps) {
  const mathRef = useRef<MathfieldElement | null>(null);
  const [latex, setLatex] = useState(initialLatex);
  const [displayMode, setDisplayMode] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [renderHtml, setRenderHtml] = useState("");

  useEffect(() => {
    if (open) {
      setLatex(initialLatex);
      setRenderError("");
    }
  }, [open, initialLatex]);

  useEffect(() => {
    if (!latex.trim()) {
      setRenderHtml("");
      setRenderError("");
      return;
    }
    try {
      const html = katex.renderToString(latex, {
        throwOnError: true,
        displayMode,
        strict: "ignore",
      });
      setRenderHtml(html);
      setRenderError("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Format LaTeX tidak valid";
      setRenderError(msg);
      setRenderHtml("");
    }
  }, [latex, displayMode]);

  if (!open) return null;

  const handleInsertTemplate = (insert: string) => {
    const mf = mathRef.current;
    if (mf) {
      // Sisipkan dengan placeholder pada posisi cursor
      mf.executeCommand(["insert", insert, { focus: "true", selectionMode: "placeholder" }]);
    } else {
      setLatex((prev) => prev + insert.replace(/#[?0]/g, ""));
    }
  };

  const handleConfirm = () => {
    if (!latex.trim()) {
      onClose();
      return;
    }
    if (renderError) return;
    onConfirm(latex.trim(), displayMode);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-bg-card rounded-2xl shadow-xl border border-border max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-admin-accent" />
            <h2 className="text-base font-semibold text-text-primary">
              Sisipkan Formula Matematika
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-text-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Visual + LaTeX editor in one (mathlive bisa langsung edit LaTeX juga) */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Editor formula
            </label>
            <math-field
              ref={mathRef}
              style={{
                width: "100%",
                minHeight: "60px",
                fontSize: "20px",
                padding: "12px",
                border: "1px solid var(--color-border)",
                borderRadius: "12px",
                background: "white",
              }}
              value={latex}
              onInput={(e) => {
                const target = e.target as MathfieldElement;
                setLatex(target.value || "");
              }}
            />
            <p className="text-xs text-text-muted mt-1.5">
              Ketik langsung atau klik tombol toolbar mathlive. Bisa juga ketik LaTeX seperti{" "}
              <code className="px-1 bg-gray-100 rounded">\frac{`{a}{b}`}</code>.
            </p>
          </div>

          {/* Quick templates as rendered formulas */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Template cepat
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t, idx) => {
                let html = "";
                try {
                  html = katex.renderToString(t.latex, {
                    throwOnError: false,
                    displayMode: false,
                    strict: "ignore",
                  });
                } catch {
                  html = t.latex;
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsertTemplate(t.insert)}
                    title={t.latex}
                    className="px-3 py-1.5 min-w-[44px] flex items-center justify-center bg-white hover:bg-admin-accent/5 hover:border-admin-accent border border-border rounded-lg transition-colors"
                  >
                    <span dangerouslySetInnerHTML={{ __html: html }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Display mode toggle */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={displayMode}
              onChange={(e) => setDisplayMode(e.target.checked)}
            />
            <span className="text-text-secondary">
              Block formula (centered, font besar)
            </span>
          </label>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Preview
            </label>
            <div
              className={`min-h-[60px] px-4 py-3 border border-border rounded-xl bg-gray-50 ${
                displayMode ? "text-center text-lg" : "text-base"
              }`}
            >
              {renderError ? (
                <p className="text-sm text-danger">⚠️ {renderError}</p>
              ) : renderHtml ? (
                <span dangerouslySetInnerHTML={{ __html: renderHtml }} />
              ) : (
                <span className="text-text-muted text-sm">
                  Preview akan muncul di sini saat kamu mengetik...
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-light">
          <Button variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!!renderError || !latex.trim()}>
            Sisipkan
          </Button>
        </div>
      </div>
    </div>
  );
}
