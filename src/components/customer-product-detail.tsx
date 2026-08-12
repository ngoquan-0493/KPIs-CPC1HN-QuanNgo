"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatVnd } from "@/lib/sales-channel";

type ProductRow = {
  ten_san_pham_chuan_hoa: string | null;
  so_lan_phat_sinh: number | null;
  tong_so_luong: number | null;
  tong_doanh_thu: number | null;
  ngay_mua_gan_nhat: string | null;
};

// Xem chi tiet san pham da mua cua 1 khach hang - cung pattern voi
// code-moi-detail.tsx/mo-moi-sptt-detail.tsx (client, fetch khi mo lan dau,
// cache trong state). Nguon: view "v_customer_product_summary" (tong hop san
// pham theo khach hang, khong gioi han theo thang - phu hop cho tra cuu).
export default function CustomerProductDetail({ maKhach }: { maKhach: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ProductRow[] | null>(null);

  async function handleClick() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (rows !== null) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("v_customer_product_summary")
      .select("ten_san_pham_chuan_hoa,so_lan_phat_sinh,tong_so_luong,tong_doanh_thu,ngay_mua_gan_nhat")
      .eq("ma_khach", maKhach)
      .order("tong_doanh_thu", { ascending: false })
      .limit(30);
    setRows((data as ProductRow[]) ?? []);
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className="cursor-pointer rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
      >
        {open ? "Ẩn sản phẩm" : "Xem sản phẩm đã mua"}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
          {loading && <p className="text-slate-400">Đang tải...</p>}
          {!loading && rows && rows.length === 0 && (
            <p className="text-slate-400">Chưa có dữ liệu mua hàng của khách này.</p>
          )}
          {!loading && rows && rows.length > 0 && (
            <table className="data-table w-full text-left">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-1 pr-2 font-medium">Sản phẩm</th>
                  <th className="py-1 pr-2 font-medium">Số lần mua</th>
                  <th className="py-1 pr-2 font-medium">Số lượng</th>
                  <th className="py-1 pr-2 font-medium">Doanh thu</th>
                  <th className="py-1 font-medium">Mua gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="py-1 pr-2 text-slate-900">{r.ten_san_pham_chuan_hoa ?? "—"}</td>
                    <td className="py-1 pr-2 text-slate-700">{r.so_lan_phat_sinh ?? 0}</td>
                    <td className="py-1 pr-2 text-slate-700">{r.tong_so_luong ?? 0}</td>
                    <td className="py-1 pr-2 text-slate-700">{formatVnd(r.tong_doanh_thu ?? 0)}</td>
                    <td className="py-1 text-slate-500">{r.ngay_mua_gan_nhat ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
