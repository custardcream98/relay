// packages/dashboard/src/components/MarkdownContent.tsx
// Lightweight markdown renderer with no dependencies

import type { ReactNode } from "react";

// Inline element parser: **bold**, *italic*, `code`
function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-zinc-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          className="font-mono text-[11px] bg-zinc-800 text-emerald-300 px-1 py-0.5 rounded"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={i} className="italic text-zinc-300">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

export function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

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
          key={key++}
          className="my-2 rounded bg-zinc-900 border border-zinc-800 px-3 py-2 overflow-x-auto"
        >
          {lang && (
            <div className="text-[10px] text-zinc-600 mb-1.5 font-mono uppercase tracking-wider">
              {lang}
            </div>
          )}
          <code className="font-mono text-[11px] leading-relaxed text-emerald-300">
            {codeLines.join("\n")}
          </code>
        </pre>
      );
      i++; // closing ```
      continue;
    }

    // H1
    if (line.startsWith("# ")) {
      nodes.push(
        <p key={key++} className="mt-2 mb-0.5 text-sm font-semibold text-zinc-100">
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
          key={key++}
          className="mt-1.5 mb-0.5 text-xs font-semibold text-zinc-300 uppercase tracking-wide"
        >
          {renderInline(line.slice(depth))}
        </p>
      );
      i++;
      continue;
    }

    // Table rows
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
        <div key={key++} className="my-1.5 overflow-x-auto">
          <table className="text-xs w-full border-collapse">
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri === 0 ? "border-b border-zinc-800" : ""}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`py-1 pr-4 ${ri === 0 ? "text-zinc-400 font-medium" : "text-zinc-300"}`}
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
        <div key={key++} className="flex gap-2 text-sm leading-relaxed">
          <span className="text-zinc-600 mt-0.5 flex-shrink-0">·</span>
          <span className="text-zinc-300">{renderInline(line.slice(2))}</span>
        </div>
      );
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      nodes.push(<div key={key++} className="h-1.5" />);
      i++;
      continue;
    }

    // Plain text
    nodes.push(
      <p key={key++} className="text-sm leading-relaxed text-zinc-300">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{nodes}</div>;
}
