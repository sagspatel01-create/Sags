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
  { label: "Map", href: "/map", milestone: 1, ready: false },
  { label: "Communities", href: "/communities", milestone: 2, ready: false },
  { label: "Client Profile", href: "/client", milestone: 3, ready: false },
  { label: "Compare", href: "/compare", milestone: 4, ready: false },
  { label: "Filters", href: "/browse", milestone: 6, ready: false },
  { label: "Admin", href: "/admin", milestone: null, ready: false },
  { label: "Sources", href: "/sources", milestone: null, ready: false },
];
