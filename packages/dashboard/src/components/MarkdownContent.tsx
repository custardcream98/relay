// packages/dashboard/src/components/MarkdownContent.tsx
// Lightweight dependency-free markdown renderer

import type { ReactNode } from "react";
import { memo } from "react";
import { cn } from "../lib/cn";

// Inline element parser: **bold**, *italic*, `code`
function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-[var(--color-text-primary)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          className="font-mono text-[11px] bg-[var(--color-surface-overlay)] text-[var(--color-text-primary)] px-1 rounded-[3px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={i} className="italic text-[var(--color-text-secondary)]">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

export const MarkdownContent = memo(function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;
  let index = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre
          key={`block-${index++}`}
          className="my-2 overflow-x-auto bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] rounded p-[8px_12px]"
        >
          {lang && (
            <div className="font-mono uppercase text-[10px] text-[var(--color-text-disabled)] mb-1.5 tracking-[0.05em]">
              {lang}
            </div>
          )}
          <code className="font-mono text-[11px] leading-[1.6] text-[var(--color-text-secondary)]">
            {codeLines.join("\n")}
          </code>
        </pre>
      );
      i++; // skip closing ```
      continue;
    }

    // H1
    if (line.startsWith("# ")) {
      nodes.push(
        <p
          key={`block-${index++}`}
          className="mt-2 mb-0.5 text-sm font-semibold text-[var(--color-text-primary)]"
        >
          {renderInline(line.slice(2))}
        </p>
      );
      i++;
      continue;
    }

    // H2/H3
    if (line.startsWith("## ") || line.startsWith("### ")) {
      const depth = line.startsWith("### ") ? 4 : 3;
      nodes.push(
        <p
          key={`block-${index++}`}
          className="mt-1.5 mb-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]"
        >
          {renderInline(line.slice(depth))}
        </p>
      );
      i++;
      continue;
    }

    // Table row
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i]
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        // Skip separator rows (---)
        if (!cells.every((c) => /^[-:]+$/.test(c))) {
          rows.push(cells);
        }
        i++;
      }
      nodes.push(
        <div key={`block-${index++}`} className="my-1.5 overflow-x-auto">
          <table className="text-xs w-full border-collapse">
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={ri === 0 ? "border-b border-[var(--color-border-subtle)]" : ""}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "py-1 pr-4",
                        ri === 0
                          ? "text-[var(--color-text-secondary)] font-medium"
                          : "text-[var(--color-text-primary)]"
                      )}
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // List item
    if (line.match(/^[-*] /)) {
      nodes.push(
        <div key={`block-${index++}`} className="flex gap-2 text-sm leading-relaxed">
          <span className="mt-0.5 shrink-0 text-[var(--color-text-tertiary)]">·</span>
          <span className="text-[var(--color-text-secondary)]">{renderInline(line.slice(2))}</span>
        </div>
      );
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      nodes.push(<div key={`block-${index++}`} className="h-1.5" />);
      i++;
      continue;
    }

    // Plain text
    nodes.push(
      <p
        key={`block-${index++}`}
        className="text-sm leading-relaxed text-[var(--color-text-secondary)]"
      >
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{nodes}</div>;
});
