"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import katex from "katex";
import "katex/dist/katex.min.css";

// =====================================================================
// Inline math node — $...$ rendered inline
// =====================================================================

function MathInlineView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const latex = (node.attrs.latex || "") as string;

  let html = "";
  let error = "";
  try {
    html = katex.renderToString(latex || "\\,", {
      throwOnError: true,
      displayMode: false,
      strict: "ignore",
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Invalid LaTeX";
  }

  const isSelected = editor.state.selection.from === getPos();

  return (
    <NodeViewWrapper
      as="span"
      className={`fk-math-inline inline-block align-middle cursor-pointer rounded px-0.5 ${
        isSelected ? "bg-admin-accent/10 ring-1 ring-admin-accent/30" : ""
      } ${error ? "bg-red-50 text-danger" : ""}`}
      onClick={() => {
        const event = new CustomEvent("fikra:edit-math", {
          detail: { latex, displayMode: false, pos: getPos() },
        });
        window.dispatchEvent(event);
      }}
      data-latex={latex}
    >
      {error ? (
        <span title={error}>⚠️ {latex}</span>
      ) : (
        <span dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </NodeViewWrapper>
  );
}

export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-latex") || "",
        renderHTML: (attrs) => ({ "data-latex": attrs.latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-math-inline="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-math-inline": "true",
        class: "fk-math-inline",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView);
  },
});

// =====================================================================
// Block math — centered, larger
// =====================================================================

function MathBlockView({ node, editor, getPos }: NodeViewProps) {
  const latex = (node.attrs.latex || "") as string;

  let html = "";
  let error = "";
  try {
    html = katex.renderToString(latex || "\\,", {
      throwOnError: true,
      displayMode: true,
      strict: "ignore",
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Invalid LaTeX";
  }

  const isSelected = editor.state.selection.from === getPos();

  return (
    <NodeViewWrapper
      className={`fk-math-block my-3 px-4 py-2 rounded-lg cursor-pointer text-center ${
        isSelected ? "bg-admin-accent/5 ring-1 ring-admin-accent/30" : "bg-gray-50"
      } ${error ? "bg-red-50 text-danger" : ""}`}
      onClick={() => {
        const event = new CustomEvent("fikra:edit-math", {
          detail: { latex, displayMode: true, pos: getPos() },
        });
        window.dispatchEvent(event);
      }}
      data-latex={latex}
    >
      {error ? (
        <p>⚠️ {error}</p>
      ) : (
        <span dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </NodeViewWrapper>
  );
}

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-latex") || "",
        renderHTML: (attrs) => ({ "data-latex": attrs.latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-math-block="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-math-block": "true",
        class: "fk-math-block",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },
});
