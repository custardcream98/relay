// packages/dashboard/src/components/MarkdownContent.tsx
// 의존성 없는 경량 마크다운 렌더러

import type { ReactNode } from "react";

// 인라인 요소 파서: **bold**, *italic*, `code`
function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          className="font-mono"
          style={{
            fontSize: 11,
            // surface-overlay 배경, text-primary 색상 (이전: zinc-800, emerald)
            background: "var(--color-surface-overlay)",
            color: "var(--color-text-primary)",
            padding: "0 4px",
            borderRadius: 3,
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={i} className="italic" style={{ color: "var(--color-text-secondary)" }}>
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

    // 코드 블록
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
          className="my-2 overflow-x-auto"
          style={{
            // surface-inset 배경, border-subtle 테두리
            background: "var(--color-surface-inset)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: 4,
            padding: "8px 12px",
          }}
        >
          {lang && (
            <div
              className="font-mono uppercase"
              style={{
                fontSize: 10,
                color: "var(--color-text-disabled)",
                marginBottom: 6,
                letterSpacing: "0.05em",
              }}
            >
              {lang}
            </div>
          )}
          <code
            className="font-mono"
            style={{
              fontSize: 11,
              lineHeight: 1.6,
              // text-secondary (이전: emerald)
              color: "var(--color-text-secondary)",
            }}
          >
            {codeLines.join("\n")}
          </code>
        </pre>
      );
      i++; // 닫는 ``` 건너뜀
      continue;
    }

    // H1
    if (line.startsWith("# ")) {
      nodes.push(
        <p
          key={key++}
          className="mt-2 mb-0.5 text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
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
          key={key++}
          className="mt-1.5 mb-0.5 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {renderInline(line.slice(depth))}
        </p>
      );
      i++;
      continue;
    }

    // 테이블 행
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i]
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        // 구분선 행 제외 (---)
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
                <tr
                  key={ri}
                  style={
                    ri === 0 ? { borderBottom: "1px solid var(--color-border-subtle)" } : undefined
                  }
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="py-1 pr-4"
                      style={{
                        color:
                          ri === 0 ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                        fontWeight: ri === 0 ? 500 : undefined,
                      }}
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

    // 리스트 항목
    if (line.match(/^[-*] /)) {
      nodes.push(
        <div key={key++} className="flex gap-2 text-sm leading-relaxed">
          <span className="mt-0.5 flex-shrink-0" style={{ color: "var(--color-text-tertiary)" }}>
            ·
          </span>
          <span style={{ color: "var(--color-text-secondary)" }}>
            {renderInline(line.slice(2))}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // 빈 줄
    if (line.trim() === "") {
      nodes.push(<div key={key++} className="h-1.5" />);
      i++;
      continue;
    }

    // 일반 텍스트
    nodes.push(
      <p
        key={key++}
        className="text-sm leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{nodes}</div>;
}
