"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading2,
  Heading3,
  ImageIcon,
  Link2,
  Calculator,
  Sigma,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table as TableIconLucide,
  Minus,
} from "lucide-react";
import { MathInline, MathBlock } from "./extensions/MathExtensions";
import { ResizableImage } from "./extensions/ResizableImage";
import MathInputDialog from "./MathInputDialog";
import TableInsertDialog from "./TableInsertDialog";
import { uploadAPI, assetUrl } from "@/lib/api";

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? "bg-admin-accent/10 text-admin-accent"
          : "text-text-secondary hover:bg-gray-100 hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-border mx-0.5" />;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

interface MathDialogState {
  open: boolean;
  initialLatex: string;
  displayMode: boolean;
  editingPos: number | null;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Tulis di sini...",
  minHeight = "120px",
  className = "",
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mathDialog, setMathDialog] = useState<MathDialogState>({
    open: false,
    initialLatex: "",
    displayMode: false,
    editingPos: null,
  });
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Exclude karena didefinisikan ulang di bawah dengan konfigurasi khusus
        link: false,
        underline: false,
      }),
      Underline,
      Placeholder.configure({ placeholder }),
      ResizableImage.configure({
        inline: false,
        HTMLAttributes: { class: "fk-content-image rounded-lg max-w-full" },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-admin-accent underline", target: "_blank" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      MathInline,
      MathBlock,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: `fk-prose prose prose-sm max-w-none focus:outline-none px-3.5 py-3 ${className}`,
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  // Listen ke event klik dari MathExtensions untuk membuka dialog edit
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ latex: string; displayMode: boolean; pos: number }>;
      setMathDialog({
        open: true,
        initialLatex: ev.detail.latex,
        displayMode: ev.detail.displayMode,
        editingPos: ev.detail.pos,
      });
    };
    window.addEventListener("fikra:edit-math", handler);
    return () => window.removeEventListener("fikra:edit-math", handler);
  }, []);

  const handleImageSelect = useCallback(async (file: File) => {
    if (!editor) return;
    setUploadingImage(true);
    try {
      const res = await uploadAPI.questionImage(file);
      const url = assetUrl(res.data.url);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || "Gagal upload gambar");
    } finally {
      setUploadingImage(false);
    }
  }, [editor]);

  const openMathDialog = (displayMode: boolean) => {
    setMathDialog({ open: true, initialLatex: "", displayMode, editingPos: null });
  };

  const handleMathConfirm = (latex: string, displayMode: boolean) => {
    if (!editor) return;
    if (mathDialog.editingPos !== null) {
      // Edit existing — replace at position
      editor
        .chain()
        .focus()
        .setNodeSelection(mathDialog.editingPos)
        .deleteSelection()
        .insertContent({
          type: displayMode ? "mathBlock" : "mathInline",
          attrs: { latex },
        })
        .run();
    } else {
      // Insert new
      editor
        .chain()
        .focus()
        .insertContent({
          type: displayMode ? "mathBlock" : "mathInline",
          attrs: { latex },
        })
        .run();
    }
    setMathDialog({ open: false, initialLatex: "", displayMode: false, editingPos: null });
  };

  const insertLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href;
    const url = window.prompt("URL link:", previous || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const insertTable = () => {
    setTableDialogOpen(true);
  };

  const handleTableInsert = (rows: number, cols: number, withHeader: boolean) => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: withHeader }).run();
  };

  if (!editor) {
    return (
      <div className="border border-border rounded-xl bg-bg-card" style={{ minHeight }}>
        <div className="px-3 py-3 text-sm text-text-muted">Memuat editor...</div>
      </div>
    );
  }

  return (
    <>
      <div className="border border-border rounded-xl bg-bg-card overflow-hidden focus-within:ring-4 focus-within:ring-admin-accent/10 focus-within:border-admin-accent/50 transition-all">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border-light bg-gray-50/50">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive("code")}
            title="Inline code"
          >
            <Code className="w-4 h-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            active={editor.isActive({ textAlign: "left" })}
            title="Align left"
          >
            <AlignLeft className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            active={editor.isActive({ textAlign: "center" })}
            title="Align center"
          >
            <AlignCenter className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            active={editor.isActive({ textAlign: "right" })}
            title="Align right"
          >
            <AlignRight className="w-4 h-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet list"
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Numbered list"
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Quote"
          >
            <Quote className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal rule"
          >
            <Minus className="w-4 h-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton onClick={() => fileInputRef.current?.click()} title="Sisipkan gambar" disabled={uploadingImage}>
            <ImageIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={insertLink} active={editor.isActive("link")} title="Sisipkan link">
            <Link2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={insertTable} title="Sisipkan tabel">
            <TableIconLucide className="w-4 h-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => openMathDialog(false)}
            title="Math inline (rumus dalam baris)"
          >
            <Sigma className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => openMathDialog(true)}
            title="Math block (rumus tampilan besar)"
          >
            <Calculator className="w-4 h-4" />
          </ToolbarButton>
        </div>

        {/* Editor area */}
        <EditorContent editor={editor} />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImageSelect(f);
            e.target.value = "";
          }}
        />
      </div>

      <MathInputDialog
        open={mathDialog.open}
        initialLatex={mathDialog.initialLatex}
        onClose={() =>
          setMathDialog({
            open: false,
            initialLatex: "",
            displayMode: false,
            editingPos: null,
          })
        }
        onConfirm={handleMathConfirm}
      />

      <TableInsertDialog
        open={tableDialogOpen}
        onClose={() => setTableDialogOpen(false)}
        onConfirm={handleTableInsert}
      />
    </>
  );
}

// Helper untuk render output di luar editor (read-only)
export function RichTextRenderer({
  html,
  className = "",
}: {
  html: string;
  className?: string;
}) {
  // Render math nodes pakai katex
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const inlines = containerRef.current.querySelectorAll<HTMLElement>('[data-math-inline="true"]');
    const blocks = containerRef.current.querySelectorAll<HTMLElement>('[data-math-block="true"]');
    inlines.forEach((el) => {
      const latex = el.getAttribute("data-latex") || "";
      try {
        el.innerHTML = require("katex").renderToString(latex, { displayMode: false, throwOnError: false });
      } catch { /* ignore */ }
    });
    blocks.forEach((el) => {
      const latex = el.getAttribute("data-latex") || "";
      try {
        el.innerHTML = require("katex").renderToString(latex, { displayMode: true, throwOnError: false });
      } catch { /* ignore */ }
    });
  }, [html]);

  return (
    <div
      ref={containerRef}
      className={`fk-prose prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export type { Editor };
