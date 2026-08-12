"use client";

import { useEffect, useRef, useState } from "react";

// O tim-chon dung chung cho khach hang/san pham trong trang xay dung KPI.
// Khac voi ProductSelector (dung <datalist> tinh, phu hop danh sach vai tram
// muc co san tren trang) - o day danh sach tong co the toi hang nghin dong
// (khach_hang_master ~5600 dong) nen tim theo kieu goi server action moi lan
// go (debounce), khong dua ca danh sach xuong client.
export default function KpiAutocomplete<T>({
  value,
  displayValue,
  onSelect,
  onClear,
  search,
  getKey,
  getLabel,
  placeholder,
  disabled,
}: {
  value: string | null;
  displayValue: string | null;
  onSelect: (item: T) => void;
  onClear: () => void;
  search: (q: string) => Promise<T[]>;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  placeholder: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleQueryChange(q: string) {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) {
      setOptions([]);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const results = await search(q);
        setOptions(results);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  if (value && displayValue) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">
        <span className="min-w-0 flex-1 truncate text-slate-800">{displayValue}</span>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              onClear();
              setQuery("");
            }}
            className="shrink-0 text-slate-400 hover:text-slate-600"
            title="Bỏ chọn"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          handleQueryChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-50"
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full min-w-[220px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading && <p className="px-2.5 py-2 text-xs text-slate-400">Đang tìm…</p>}
          {!loading && options.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-slate-400">Không tìm thấy kết quả.</p>
          )}
          {!loading &&
            options.map((opt) => (
              <button
                key={getKey(opt)}
                type="button"
                onClick={() => {
                  onSelect(opt);
                  setOpen(false);
                  setQuery("");
                }}
                className="block w-full truncate px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-blue-50"
              >
                {getLabel(opt)}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
