"use client";

import { Image as TipTapImage } from "@tiptap/extension-image";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useRef, useState, useEffect } from "react";

// Custom Image dengan kemampuan resize lewat drag handles di pojok kanan-bawah.
// Width disimpan sebagai attribute (px atau %).

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [resizing, setResizing] = useState(false);
  const [hover, setHover] = useState(false);

  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string) || "";
  const widthAttr = node.attrs.width as string | number | null;
  const align = (node.attrs.align as string) || "center";

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!imgRef.current || !containerRef.current) return;

    const startX = e.clientX;
    const startWidth = imgRef.current.getBoundingClientRect().width;
    const containerWidth = containerRef.current.parentElement?.clientWidth || startWidth;
    setResizing(true);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const newWidth = Math.max(60, Math.min(containerWidth, startWidth + dx));
      // Simpan dalam % supaya responsive
      const pct = Math.round((newWidth / containerWidth) * 100);
      updateAttributes({ width: `${pct}%` });
    };

    const onUp = () => {
      setResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const widthStyle = widthAttr
    ? typeof widthAttr === "number"
      ? `${widthAttr}px`
      : String(widthAttr)
    : "auto";

  const alignClass =
    align === "left" ? "mr-auto" : align === "right" ? "ml-auto" : "mx-auto";

  return (
    <NodeViewWrapper
      as="div"
      className={`fk-resizable-image relative my-2 ${alignClass}`}
      style={{ width: widthStyle, maxWidth: "100%" }}
      data-drag-handle
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div ref={containerRef} className="relative inline-block">
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={`block w-full h-auto rounded-lg ${
            selected || resizing ? "ring-2 ring-admin-accent" : ""
          }`}
          draggable={false}
        />

        {/* Toolbar align (muncul saat hover/select) */}
        {(hover || selected) && !resizing && (
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1 py-0.5 bg-ink text-white rounded-md shadow-lg text-xs">
            <button
              type="button"
              onClick={() => updateAttributes({ align: "left" })}
              className={`px-1.5 py-0.5 rounded hover:bg-white/20 ${align === "left" ? "bg-white/20" : ""}`}
              title="Align left"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ align: "center" })}
              className={`px-1.5 py-0.5 rounded hover:bg-white/20 ${align === "center" ? "bg-white/20" : ""}`}
              title="Center"
            >
              ↔
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ align: "right" })}
              className={`px-1.5 py-0.5 rounded hover:bg-white/20 ${align === "right" ? "bg-white/20" : ""}`}
              title="Align right"
            >
              →
            </button>
            <span className="w-px h-3 bg-white/30 mx-0.5" />
            <button
              type="button"
              onClick={() => updateAttributes({ width: "25%" })}
              className="px-1.5 py-0.5 rounded hover:bg-white/20"
              title="25% width"
            >
              S
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ width: "50%" })}
              className="px-1.5 py-0.5 rounded hover:bg-white/20"
              title="50% width"
            >
              M
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ width: "100%" })}
              className="px-1.5 py-0.5 rounded hover:bg-white/20"
              title="Full width"
            >
              L
            </button>
          </div>
        )}

        {/* Resize handle */}
        {(selected || hover) && (
          <div
            onPointerDown={startResize}
            className="absolute -bottom-1 -right-1 w-3 h-3 bg-admin-accent rounded-full cursor-nwse-resize ring-2 ring-white shadow"
            title="Drag untuk ubah ukuran"
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const ResizableImage = TipTapImage.extend({
  name: "image",
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("width") || (el as HTMLElement).style.width || null,
        renderHTML: (attrs) => {
          if (!attrs.width) return {};
          return {
            width: attrs.width,
            style: `width: ${attrs.width}`,
          };
        },
      },
      align: {
        default: "center",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-align") || "center",
        renderHTML: (attrs) => ({ "data-align": attrs.align }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
