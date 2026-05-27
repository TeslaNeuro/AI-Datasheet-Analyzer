import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  items?: string[] | null;
  tone?: "default" | "warn" | "danger" | "accent";
}

export function BulletList({ items, tone = "default" }: Props) {
  if (!items || items.length === 0) return null;
  const dot =
    tone === "danger"
      ? "before:bg-danger-500"
      : tone === "warn"
        ? "before:bg-warn-500"
        : tone === "accent"
          ? "before:bg-accent-500"
          : "before:bg-ink-500";

  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li
          key={i}
          className={[
            "relative pl-5 text-sm text-ink-200 leading-relaxed",
            "before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full",
            dot,
          ].join(" ")}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <span>{children}</span>,
              code: ({ children }) => (
                <code className="rounded bg-ink-800 px-1 py-0.5 text-[0.85em] font-mono text-accent-400">
                  {children}
                </code>
              ),
              strong: ({ children }) => <strong className="text-ink-50">{children}</strong>,
              a: ({ children, href }) => (
                <a href={href} className="text-accent-400 hover:underline" target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {it}
          </ReactMarkdown>
        </li>
      ))}
    </ul>
  );
}
