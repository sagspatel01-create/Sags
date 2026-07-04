"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav";

/** Left rail — quiet, editorial, always visible on the protected shell.
 *  Active route is marked with a gold indicator for orientation. */
export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-500 bg-ink-850/80 backdrop-blur md:flex">
      <div className="px-6 py-7">
        <p className="text-eyebrow">Dubai</p>
        <p className="mt-1 font-display text-lg leading-tight text-paper-100">
          Villa &amp; Townhouse
          <br />
          Intelligence
        </p>
        <hr className="gold-rule mt-4" />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV.map((item) => {
          const active = item.ready && isActive(item.href);
          const content = (
            <div
              className={`group relative flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-ink-700/70 text-paper-100"
                  : "text-paper-300 hover:bg-ink-700 hover:text-paper-100"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent-400" />
              )}
              <span>{item.label}</span>
              {!item.ready && (
                <span className="text-[0.625rem] uppercase tracking-wider text-paper-700">
                  {item.milestone ? `M${item.milestone}` : "soon"}
                </span>
              )}
            </div>
          );
          return item.ready ? (
            <Link key={item.href} href={item.href}>
              {content}
            </Link>
          ) : (
            <div key={item.href} className="cursor-default opacity-70">
              {content}
            </div>
          );
        })}
      </nav>

      <div className="px-6 py-5 text-[0.625rem] leading-relaxed text-paper-700">
        Private · single admin
      </div>
    </aside>
  );
}
