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

// Cot "tinh" khong dong nhat giua nguon du lieu: "Du lieu sale tong" (lich su,
// dong bo tu Google Sheet cu) dung ten ngan "Hà Nội", con "Du lieu sale thang
// hien tai" (nguon dang chay) dung ten hanh chinh day du "Thành phố Hà Nội" /
// "Tỉnh Bắc Ninh" - neu gop nhom truc tiep theo tinh se bi tach thanh 2 dong
// rieng cho cung 1 tinh. Ngoai ra con vai truong hop chinh ta khac nhau giua
// cac dong ("Hoà Bình" vs "Hòa Bình", "Thanh hóa" vs "Thanh Hóa"). Ham nay
// chuan hoa ve 1 ten hien thi duy nhat cho moi tinh.
const TINH_CASING_FIX: Record<string, string> = {
  "hoà bình": "Hòa Bình",
  "thanh hóa": "Thanh Hóa",
};

export function normalizeTinh(raw: string | null | undefined) {
  let v = (raw ?? "").trim();
  if (!v) return "Không xác định";
  v = v.normalize("NFC").replace(/^(Thành phố|Tỉnh|TP\.?)\s+/i, "").trim();
  const key = v.toLowerCase();
  return TINH_CASING_FIX[key] ?? v;
}

// Cot "don_vi_tinh" cung khong dong nhat - vua co ma code viet hoa (LO, ONG,
// VIEN, TUBE...) vua co tieng Viet co dau (Lọ, Ống, Viên, Tuýp...) cho CUNG 1
// don vi, tuy dong du lieu. Chuan hoa ve 1 nhan tieng Viet duy nhat de hien
// thi san luong (vd "1.200 Lọ") khong bi lap 2 kieu viet khac nhau.
const DON_VI_MAP: Record<string, string> = {
  lo: "Lọ",
  ong: "Ống",
  vien: "Viên",
  tube: "Tuýp",
  tuyp: "Tuýp",
  hop: "Hộp",
  chai: "Chai",
  goi: "Gói",
  vi: "Vỉ",
  tuip: "Tuýp",
};

export function normalizeUnit(raw: string | null | undefined) {
  const v = (raw ?? "").trim();
  if (!v) return "";
  const key = v.normalize("NFC").toLowerCase();
  return DON_VI_MAP[key] ?? v;
}

export function formatQty(n: number, unit?: string) {
  return n.toLocaleString("vi-VN") + (unit ? ` ${unit}` : "");
}

// "Du lieu sale tong" la nguon LICH SU/DA DONG SO, "Du lieu sale thang hien
// tai" chi nen chua THANG DANG CHAY. Binh thuong 2 bang khong trung thang
// nhau - nhung neu dong bo n8n bi loi khong don duoc du lieu thang cu khoi
// "sale thang hien tai" khi sang thang moi (da tung xay ra thuc te, vd thang
// 7/2026 con nguyen trong "sale thang hien tai" ngay ca khi da co day du
// trong "sale tong"), thi 1 thang co the ton tai o CA HAI bang cung luc. Gop
// truc tiep 2 bang trong truong hop do se DEM GAP DOI. 2 ham duoi day chan
// truong hop nay bang cach uu tien "sale tong" (nguon da chot so) cho thang
// da co trong do.

// Dung khi cau query da loc san 1 thang cu the (.eq("nam", x).eq("thang", y))
// o CA HAI phia - neu "sale tong" da co du lieu cho thang do thi bo qua toan
// bo "sale thang hien tai" (tranh dem trung), chi dung "sale thang hien tai"
// khi "sale tong" thuc su chua co gi (dung thang dang chay).
export function preferClosedMonthRows<T>(tongRows: T[], hienTaiRows: T[]): T[] {
  return tongRows.length > 0 ? tongRows : hienTaiRows;
}

// Dung khi cau query trai dai NHIEU thang (khong loc san 1 thang cu the) -
// gop theo tung thang (rut ra tu cot "ngay", dang "YYYY-MM-DD"): thang nao da
// co du lieu trong "sale tong" thi bo qua dong tuong ung ben "sale thang hien
// tai", chi giu lai o "sale thang hien tai" cac thang CHUA xuat hien trong
// "sale tong".
export function mergeSaleRowsByMonth<T extends { ngay?: string | null }>(
  tongRows: T[],
  hienTaiRows: T[],
): T[] {
  const closedMonths = new Set(tongRows.map((r) => (r.ngay ?? "").slice(0, 7)).filter(Boolean));
  const hienTaiConLai = hienTaiRows.filter((r) => !closedMonths.has((r.ngay ?? "").slice(0, 7)));
  return [...tongRows, ...hienTaiConLai];
}
