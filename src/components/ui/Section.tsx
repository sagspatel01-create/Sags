import type { ReactNode } from "react";

/** A titled content section — eyebrow label + serif heading + body. */
export function Section({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-ink-500 py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="text-eyebrow">{eyebrow}</p>}
          <h2 className="mt-1 font-display text-2xl text-paper-100">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
