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
        <strong key={i} className="font-semibold text-(--color-text-primary)">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          className="rounded-[3px] bg-(--color-surface-overlay) px-1 font-mono text-[11px] text-(--color-text-primary)"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={i} className="text-(--color-text-secondary) italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    // Plain text: wrap in a fragment with key to satisfy React's array-child key requirement
    return <span key={i}>{part}</span>;
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
          className="my-2 overflow-x-auto rounded border border-(--color-border-subtle) bg-(--color-surface-inset) p-[8px_12px]"
        >
          {lang && (
            <div className="mb-1.5 font-mono text-[10px] tracking-[0.05em] text-(--color-text-disabled) uppercase">
              {lang}
            </div>
          )}
          <code className="font-mono text-[11px] leading-[1.6] text-(--color-text-secondary)">
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
          className="mt-2 mb-0.5 text-sm font-semibold text-(--color-text-primary)"
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
          className="mt-1.5 mb-0.5 text-xs font-semibold tracking-wide text-(--color-text-secondary) uppercase"
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
          <table className="w-full border-collapse text-xs">
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri === 0 ? "border-b border-(--color-border-subtle)" : ""}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "py-1 pr-4",
                        ri === 0
                          ? "font-medium text-(--color-text-secondary)"
                          : "text-(--color-text-primary)"
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
          <span className="mt-0.5 shrink-0 text-(--color-text-tertiary)">·</span>
          <span className="text-(--color-text-secondary)">{renderInline(line.slice(2))}</span>
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
      <p key={`block-${index++}`} className="text-sm leading-relaxed text-(--color-text-secondary)">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{nodes}</div>;
});
