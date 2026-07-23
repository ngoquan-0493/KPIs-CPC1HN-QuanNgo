// Supabase/PostgREST caps every response at a server-side max row count
// (1000 by default) regardless of .limit()/.range() requested by the client.
// Tables like "Du lieu sale tong" and "Du lieu cham cong thang hien tai"
// routinely exceed that in a single month, so a plain .limit(20000) silently
// drops rows (with no error) instead of fetching everything — confirmed in
// production: a specific employee's June revenue was cut because his rows
// fell outside the first 1000 returned (no ORDER BY, so drop order is
// arbitrary). Page through with .range() until a short page signals the end.
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const allRows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) return { data: allRows, error };
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { data: allRows, error: null };
}

export type ChannelSaleRow = {
  doanh_thu: number | null;
  nhom_khach_hang: string | null;
  trang_thai?: string | null;
};

export function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + " đ";
}

// Source data uses two different channel labeling schemes depending on the
// table: full Vietnamese text in "Du lieu sale tong" (e.g. "Bv kê đơn",
// "Phòng mạch", "Thầu đạp giá") and short codes in "Du lieu sale thang hien
// tai" (e.g. "KD", "U-PM", "DB-PM", "AT", "ONL"). Per company convention,
// revenue is only reported under 4 canonical channels (Kê đơn / Phòng mạch /
// Thầu / Online); anything else (MiniApp, KM, ...) falls into "Khác".
// "KD-PM" rows count as Kê đơn (not split), confirmed with the user.
export function normalizeChannel(raw: string | null) {
  const v = (raw ?? "").trim();
  if (!v) return "Khác";
  const lower = v.normalize("NFC").toLowerCase();
  const tokens = lower.split("-");

  if (tokens.includes("kd") || lower.includes("kê đơn")) return "Kê đơn";
  if (tokens.includes("pm") || lower.includes("phòng mạch")) return "Phòng mạch";
  if (tokens.includes("at") || lower.includes("thầu")) return "Thầu";
  if (tokens.includes("onl") || lower === "online") return "Online";
  return "Khác";
}

// "TraHang" (return/refund) rows, and orders cancelled ("Hủy") or on hold
// ("Treo") in "Du lieu sale thang hien tai", are excluded from revenue
// reporting entirely. "Du lieu sale tong" has no trang_thai column, so
// historical rows (trang_thai undefined) are never excluded by this check.
export function isExcludedSaleRow(r: ChannelSaleRow) {
  if ((r.nhom_khach_hang ?? "").trim().toLowerCase() === "trahang") return true;
  const trangThai = (r.trang_thai ?? "").trim().toLowerCase();
  return trangThai === "hủy" || trangThai === "huỷ" || trangThai === "treo";
}
