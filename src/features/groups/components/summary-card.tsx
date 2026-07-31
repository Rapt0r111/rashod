"use client";

export function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="min-w-0 px-3 py-0.5 first:pl-0 last:pr-0">
      <span className="block min-h-[2.4em] text-[11px] leading-tight font-bold text-text-muted">
        {label}
      </span>
      <strong
        className={`my-0.5 block overflow-hidden text-ellipsis font-mono text-xl leading-none ${tone === "ok" ? "text-green" : tone === "warn" ? "text-amber" : "text-text-primary"}`}
      >
        {value}
      </strong>
    </div>
  );
}

