import type { ReactNode } from "react";
import { Empty } from "@/components/ui/Empty";

export interface DocView {
  id: string;
  title: string;
  doc_type: string | null;
  url: string | null;
}

/** Documents / brochures shelf. Presentational — URLs resolved upstream. */
export function DocumentShelf({
  docs,
  uploader,
}: {
  docs: DocView[];
  uploader?: ReactNode;
}) {
  return (
    <div>
      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-500 p-6 text-center">
          <Empty label="No documents yet" />
          <p className="mx-auto mt-2 max-w-sm text-sm text-paper-500">
            Upload brochures, master plans, floor plans, or any project
            documents. They&apos;re stored privately and available across the
            tool.
          </p>
          {uploader && <div className="mt-4 flex justify-center">{uploader}</div>}
        </div>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">
            {docs.map((d) => (
              <li key={d.id}>
                <a
                  href={d.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-ink-500 bg-ink-800/50 px-4 py-3 transition-colors hover:bg-ink-700"
                >
                  <span className="text-paper-500">▤</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-paper-200">
                    {d.title}
                  </span>
                  {d.doc_type && (
                    <span className="shrink-0 text-[0.625rem] uppercase tracking-wider text-paper-700">
                      {d.doc_type.split("/").pop()}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
          {uploader && <div className="mt-4">{uploader}</div>}
        </>
      )}
    </div>
  );
}
