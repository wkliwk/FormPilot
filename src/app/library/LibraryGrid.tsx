"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface LibraryItem {
  slug: string;
  title: string;
  category: string;
  description: string;
  fieldCount: number;
  usedCount: number;
  source: "curated" | "community";
}

const CATEGORY_STYLES: Record<string, { color: string; bg: string }> = {
  "Tax":              { color: "text-blue-700",    bg: "bg-blue-50" },
  "Immigration":      { color: "text-violet-700",  bg: "bg-violet-50" },
  "Legal":            { color: "text-amber-700",   bg: "bg-amber-50" },
  "HR / Employment":  { color: "text-emerald-700", bg: "bg-emerald-50" },
  "Healthcare":       { color: "text-rose-700",    bg: "bg-rose-50" },
  "Housing":          { color: "text-sky-700",     bg: "bg-sky-50" },
  "General":          { color: "text-slate-700",   bg: "bg-slate-100" },
};

export default function LibraryGrid({ items, categories }: { items: LibraryItem[]; categories: string[] }) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filtered = useMemo(() => {
    let result = items;
    if (selectedCategory !== "All") {
      result = result.filter((item) => item.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, search, selectedCategory]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search forms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <CategoryChip label="All" active={selectedCategory === "All"} onClick={() => setSelectedCategory("All")} />
          {categories.map((cat) => (
            <CategoryChip key={cat} label={cat} active={selectedCategory === cat} onClick={() => setSelectedCategory(cat)} />
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500">No forms found matching your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const style = CATEGORY_STYLES[item.category] ?? { color: "text-slate-700", bg: "bg-slate-100" };
            const href = item.source === "curated" ? `/forms/${item.slug}` : `/t/${item.slug}`;
            return (
              <Link
                key={item.slug}
                href={href}
                className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>
                    {item.category}
                  </span>
                  {item.source === "community" && (
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Community</span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{item.description}</p>
                )}
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                  <span>{item.fieldCount} fields</span>
                  {item.usedCount > 0 && <span>{item.usedCount} uses</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
      }`}
    >
      {label}
    </button>
  );
}
