import DOMPurify from "dompurify";

/**
 * Sanitasi HTML dari konten yang berasal dari DB/API sebelum dirender ke DOM.
 * Mengizinkan tag HTML yang umum dipakai di konten soal (bold, italic, sup, sub, img, dll)
 * tapi memblokir script, event handler, dan atribut berbahaya.
 *
 * Gunakan ini untuk semua dangerouslySetInnerHTML yang kontennya dari server.
 * TIDAK perlu untuk HTML yang di-generate lokal oleh KaTeX/MathJax.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  if (typeof window === "undefined") {
    // SSR: tidak ada DOM, kembalikan string kosong (konten akan di-render di client)
    return "";
  }
  return DOMPurify.sanitize(dirty, {
    // Tag yang diizinkan untuk konten soal
    ALLOWED_TAGS: [
      "p", "br", "b", "strong", "i", "em", "u", "s", "strike",
      "sup", "sub", "span", "div", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "blockquote", "pre", "code",
      "table", "thead", "tbody", "tr", "th", "td",
      "img", "figure", "figcaption",
      "math", "mrow", "mi", "mn", "mo", "msup", "msub",
      "mfrac", "msqrt", "mroot", "mtext", "mspace",
      "annotation", "semantics",
    ],
    ALLOWED_ATTR: [
      "class", "style", "src", "alt", "width", "height",
      "colspan", "rowspan", "href",
      // KaTeX/MathJax attributes
      "data-value", "data-type", "xmlns", "display",
    ],
    // Blokir semua URL yang bukan http/https/data untuk img
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: false,
  });
}

/** Helper untuk pakai di dangerouslySetInnerHTML */
export function safeHtml(dirty: string | null | undefined): { __html: string } {
  return { __html: sanitizeHtml(dirty) };
}
