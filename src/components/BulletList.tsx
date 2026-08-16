/**
 * AI Datasheet Analyzer
 * Author: Arshia Keshvari (@TeslaNeuro)
 * License: MIT
 *
 * Renders analysis bullets with lightweight Markdown (GFM). Components and
 * remark plugins are hoisted to module scope so large results lists do not
 * re-parse on every parent re-render.
 */
import { memo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type Tone = "default" | "warn" | "danger" | "accent";

interface Props {
  items?: string[] | null;
  tone?: Tone;
}

/**
 * `react-markdown` re-evaluates everything when its `components` or
 * `remarkPlugins` props change identity, which previously happened on
 * every render because they were defined inline. Hoisting them to module
 * scope plus wrapping each <li> in `React.memo` cuts results-view
 * re-render cost dramatically — important because a typical analysis
 * has 60–120 bullets, each going through the unified pipeline.
 */
const REMARK_PLUGINS = [remarkGfm];

const MD_COMPONENTS: Components = {
  p: ({ children }) => <span>{children}</span>,
  code: ({ children }) => (
    <code className="rounded-sm bg-ink-800 px-1 py-0.5 text-[0.85em] font-mono text-accent-400">
      {children}
    </code>
  ),
  strong: ({ children }) => <strong className="text-ink-50">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} className="text-accent-400 hover:underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

const TONE_CLASSES: Record<Tone, string> = {
  default: "before:bg-ink-500",
  warn: "before:bg-warn-500",
  danger: "before:bg-danger-500",
  accent: "before:bg-accent-500",
};

interface BulletProps {
  text: string;
  dot: string;
}

/**
 * Each bullet is its own memoised component so unchanged items skip the
 * unified/remark/rehype pipeline entirely on parent re-renders. We
 * deliberately do NOT pass non-primitive props here so memo's default
 * shallow compare is sufficient.
 */
const Bullet = memo(function Bullet({ text, dot }: BulletProps): ReactNode {
  return (
    <li
      className={[
        "relative pl-5 text-sm text-ink-200 leading-relaxed",
        "before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full",
        dot,
      ].join(" ")}
    >
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MD_COMPONENTS}>
        {text}
      </ReactMarkdown>
    </li>
  );
});

export function BulletList({ items, tone = "default" }: Props) {
  if (!items || items.length === 0) return null;
  const dot = TONE_CLASSES[tone];
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <Bullet key={i} text={it} dot={dot} />
      ))}
    </ul>
  );
}
