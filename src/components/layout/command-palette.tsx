"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchResult = {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  category: "Session" | "Community" | "Report";
};

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  /* Open on Ctrl+K / Cmd+K */
  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* Focus input when opened */
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  /* Debounced search */
  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const tid = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
        );
        if (res.ok) {
          const data: SearchResult[] = await res.json();
          setResults(data);
          setSelectedIndex(0);
        }
      } catch {
        /* network error — stay silent */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(tid);
  }, [query]);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      navigate(results[selectedIndex].href);
    }
  }

  const CATEGORY_COLORS: Record<SearchResult["category"], string> = {
    Session: "bg-blue-50 text-blue-700",
    Community: "bg-gold-50 text-gold-700",
    Report: "bg-success-50 text-success-700",
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open search (Ctrl+K)"
        className={cn(
          "flex items-center gap-2 rounded-control border border-hairline bg-white px-3 py-1.5",
          "text-xs text-ink-400 shadow-tile transition-all hover:border-blue-300 hover:text-ink-700",
        )}
      >
        <Search className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden items-center gap-0.5 rounded border border-hairline bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium text-ink-400 sm:flex">
          <span>⌘</span>K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        className={cn(
          "fixed left-1/2 top-[15vh] z-50 w-full max-w-lg -translate-x-1/2",
          "rounded-[1.25rem] bg-white shadow-pop",
          "animate-rise",
        )}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
          {loading ? (
            <div className="size-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" aria-hidden />
          ) : (
            <Search className="size-4 shrink-0 text-ink-400" aria-hidden />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search sessions, communities, reports…"
            className="flex-1 bg-transparent text-sm text-ink-900 placeholder-ink-400 outline-none"
          />
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-control p-1 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <ul className="max-h-80 overflow-y-auto p-2">
            {results.map((r, i) => (
              <li key={r.id}>
                <button
                  onClick={() => navigate(r.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-tile px-3 py-2.5 text-left transition-colors",
                    i === selectedIndex
                      ? "bg-blue-50 text-blue-900"
                      : "text-ink-800 hover:bg-ink-50",
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      CATEGORY_COLORS[r.category],
                    )}
                  >
                    {r.category}
                  </span>
                  <span className="flex-1 text-sm font-medium">{r.label}</span>
                  {r.sublabel && (
                    <span className="text-2xs text-ink-400">{r.sublabel}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : query.trim() && !loading ? (
          <p className="px-4 py-8 text-center text-sm text-ink-400">
            No results for &ldquo;{query}&rdquo;
          </p>
        ) : !query.trim() ? (
          <p className="px-4 py-6 text-center text-sm text-ink-400">
            Type to search across sessions, communities, and reports
          </p>
        ) : null}
      </div>
    </>
  );
}
