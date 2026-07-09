/**
 * Primary navigation. Sections map to the Phase 1 build order. Items not
 * yet built are marked `milestone` so the shell can show them as upcoming
 * rather than linking to nothing.
 */
export type NavItem = {
  label: string;
  href: string;
  /** Build-order milestone this belongs to (null = foundational). */
  milestone: number | null;
  ready: boolean;
};

export const NAV: NavItem[] = [
  { label: "Overview", href: "/", milestone: null, ready: true },
  { label: "Ask", href: "/ask", milestone: null, ready: true },
  { label: "Map", href: "/map", milestone: 1, ready: true },
  { label: "Communities", href: "/communities", milestone: 2, ready: true },
  { label: "Client Profile", href: "/client", milestone: 3, ready: true },
  { label: "Compare", href: "/compare", milestone: 4, ready: true },
  { label: "Underwrite", href: "/underwrite", milestone: null, ready: true },
  { label: "Filters", href: "/browse", milestone: 6, ready: true },
  { label: "Live Market", href: "/live", milestone: null, ready: true },
  { label: "Admin", href: "/admin", milestone: null, ready: true },
  { label: "Absorb", href: "/admin/absorb", milestone: null, ready: true },
  { label: "Transactions", href: "/admin/transactions", milestone: null, ready: true },
  { label: "Sources", href: "/sources", milestone: null, ready: true },
];
