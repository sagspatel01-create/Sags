import type { ReactNode } from "react";

/** Editorial panel — hairline border, quiet surface, generous padding. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`elevate rounded-xl border border-ink-500 bg-ink-800/50 ${className}`}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-eyebrow">{children}</p>;
}
