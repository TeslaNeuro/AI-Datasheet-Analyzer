import type { ReactNode } from "react";

interface Props {
  number?: number | string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  intent?: "default" | "warn" | "danger" | "accent";
}

export function Section({ number, title, icon, children, intent = "default" }: Props) {
  const iconWrap =
    intent === "danger"
      ? "bg-danger-600/10 text-danger-400"
      : intent === "warn"
        ? "bg-warn-600/10 text-warn-400"
        : intent === "accent"
          ? "bg-accent-600/10 text-accent-400"
          : "bg-ink-800 text-ink-300";

  return (
    <section className="card p-5">
      <header className="mb-4 flex items-center gap-3">
        <div className={`grid h-9 w-9 place-items-center rounded-md ${iconWrap}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-ink-500">
            {number !== undefined ? `Section ${number}` : "Section"}
          </div>
          <h3 className="truncate text-base font-semibold text-ink-50">{title}</h3>
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

interface SubProps {
  label: string;
  children: ReactNode;
}

export function SubGroup({ label, children }: SubProps) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</div>
      {children}
    </div>
  );
}
