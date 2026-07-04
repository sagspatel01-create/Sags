import type { ReactNode } from "react";

/** Inline **bold** → <strong>, everything else plain text. */
function inline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={`${keyBase}-${i}`} className="font-medium text-paper-100">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyBase}-${i}`}>{p}</span>;
  });
}

/**
 * Tiny, dependency-free Markdown renderer for generated briefs. Supports
 * `## headings`, `- bullets`, `**bold**`, and paragraphs. Renders to React
 * elements (no raw HTML injection).
 */
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];

  const flushPara = (k: string) => {
    if (para.length) {
      blocks.push(
        <p key={k} className="leading-relaxed text-paper-300">
          {inline(para.join(" "), k)}
        </p>,
      );
      para = [];
    }
  };
  const flushList = (k: string) => {
    if (list.length) {
      blocks.push(
        <ul key={k} className="space-y-1.5">
          {list.map((li, i) => (
            <li key={i} className="flex gap-2 text-paper-300">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-500" />
              <span className="leading-relaxed">{inline(li, `${k}-${i}`)}</span>
            </li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flushPara(`p${idx}`);
      flushList(`l${idx}`);
      blocks.push(
        <h3
          key={`h${idx}`}
          className="text-eyebrow pt-2"
        >
          {line.slice(3)}
        </h3>,
      );
    } else if (line.startsWith("- ")) {
      flushPara(`p${idx}`);
      list.push(line.slice(2));
    } else if (line.trim() === "") {
      flushPara(`p${idx}`);
      flushList(`l${idx}`);
    } else {
      flushList(`l${idx}`);
      para.push(line);
    }
  });
  flushPara("p-end");
  flushList("l-end");

  return <div className="space-y-4">{blocks}</div>;
}
