"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

// Bo loc theo san pham cho trang /products - dung datalist thay vi <select>
// thuong vi danh sach co the len toi vai tram san pham, can go-de-tim thay vi
// cuon tay. Chi push router khi gia tri go khop chinh xac 1 ten san pham
// trong danh sach (tranh dieu huong theo tung ky tu dang go dang).
export default function ProductSelector({
  products,
  selected,
}: {
  products: string[];
  selected: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(selected);

  function handleChange(v: string) {
    setValue(v);
    if (!products.includes(v) || v === selected) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("sp", v);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="relative">
      <input
        list="product-options"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Chọn sản phẩm..."
        className="w-72 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
      <datalist id="product-options">
        {products.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </div>
  );
}
