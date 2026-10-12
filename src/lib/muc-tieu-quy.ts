// Muc tieu san luong theo quy: kieu du lieu + ham tinh dung chung cho trang /products (tab "Muc tieu quy").
// Nguon: RPC get_muc_tieu_quy / get_lap_don_quy (xem migration muc_tieu_quy_01..04).
// Moc so sanh cua quy N la THUC HIEN cua quy N-1; muc tieu = moc x (1 + ty_le_tang/100).

export type CauHinhQuy = {
  nam: number;
  quy: number;
  quy_goc_nam: number;
  quy_goc: number;
  ty_le_tang: number;
  trang_thai: "nhap" | "chot";
  tao_luc: string;
  chot_luc: string | null;
};

export type MetaQuy = {
  ngay_bat_dau: string;
  ngay_ket_thuc: string;
  pct_thoi_gian: number; // 0..1
  da_ket_thuc: boolean;
  tong_cap: number;
  cap_chua_lap: number;
};

// 1 dong = 1 (SS, san pham). muc_tieu = null va moi = true khi SS ban san pham nay nhung quy truoc khong co (khong ap dung).
export type DongSs = {
  ma_ss: string;
  ten_ss: string | null;
  ma_chuan: string;
  ten_san_pham: string | null;
  th_ky_truoc: number;
  muc_tieu: number | null;
  th_ky_nay: number;
  loai_tru: boolean;
  ghi_chu: string | null;
  moi: boolean;
};

export type MucTieuQuy = {
  cau_hinh: CauHinhQuy | null;
  meta?: MetaQuy;
  rows?: DongSs[];
};

export type SanPhamGop = {
  ma_chuan: string;
  ten: string;
  th_ky_truoc: number;
  muc_tieu: number;
  th_ky_nay: number; // chi tinh cac SS co muc tieu
  thNgoai: number; // SS ban nhung khong co muc tieu (moi)
  loai_tru: boolean;
  ghi_chu: string | null;
  theoSs: DongSs[]; // chi cac SS co muc tieu
  ssMoi: DongSs[]; // cac SS ban ngoai ke hoach
};

export type LapDonCap = {
  ma_ss: string;
  ma_khach: string;
  ten_khach: string | null;
  ma_nhan_vien: string | null;
  ten_nhan_vien: string | null;
  sl_ky_truoc: number;
  so_don: number;
  so_thang: number;
  muc_tieu: number;
  th_ky_nay: number;
  ngay_gan_nhat: string | null;
  ss_hien_tai: string | null;
};

export type LapDonNgoai = {
  ma_ss: string;
  ma_khach: string;
  ten_khach: string | null;
  ma_nhan_vien: string | null;
  ten_nhan_vien: string | null;
  th_ky_nay: number;
  ngay_gan_nhat: string | null;
};

export type TrangThai = "dat" | "dung" | "cham" | "nguy-co" | "khong-dat";

// Nguong trang thai (diem % = % dat - % thoi gian da qua): cham khi thap hon 10 diem, nguy co khi thap hon 25 diem.
export const NGUONG_CHAM = 0.1;
export const NGUONG_NGUY_CO = 0.25;

export function normCode(code: string | null | undefined) {
  return (code ?? "").replace(/\D/g, "").replace(/^0+/, "") || (code ?? "");
}

export function nhanQuy(nam: number, quy: number) {
  return `Q${quy}/${nam}`;
}

export function quyTruoc(nam: number, quy: number) {
  return quy === 1 ? { nam: nam - 1, quy: 4 } : { nam, quy: quy - 1 };
}

// Quy hien tai theo gio Viet Nam (server Netlify chay UTC).
export function quyHienTai() {
  const vn = new Date(Date.now() + 7 * 3600 * 1000);
  return { nam: vn.getUTCFullYear(), quy: Math.floor(vn.getUTCMonth() / 3) + 1 };
}

export function tinhTrangThai(pctDat: number, pctThoiGian: number, daKetThuc: boolean): TrangThai {
  if (daKetThuc) return pctDat >= 1 ? "dat" : "khong-dat";
  if (pctDat >= 1) return "dat";
  const lech = pctThoiGian - pctDat;
  if (lech >= NGUONG_NGUY_CO) return "nguy-co";
  if (lech >= NGUONG_CHAM) return "cham";
  return "dung";
}

export const NHAN_TRANG_THAI: Record<TrangThai, { nhan: string; tone: "success" | "info" | "warning" | "danger" }> = {
  dat: { nhan: "Đã đạt", tone: "success" },
  dung: { nhan: "Đúng tiến độ", tone: "info" },
  cham: { nhan: "Chậm", tone: "warning" },
  "nguy-co": { nhan: "Nguy cơ", tone: "danger" },
  "khong-dat": { nhan: "Không đạt", tone: "danger" },
};

export function fmtSo(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

export function fmtPct(p: number | null | undefined) {
  if (p == null || !Number.isFinite(p)) return "—";
  return `${(p * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

export function fmtNgay(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// Gop cac dong (SS x san pham) thanh danh sach san pham. ssFilter = null -> tong cac SS (ASM).
export function gopTheoSanPham(rows: DongSs[], ssFilter: string | null) {
  const nhom = new Map<string, DongSs[]>();
  for (const r of rows) {
    if (ssFilter && normCode(r.ma_ss) !== normCode(ssFilter)) continue;
    const arr = nhom.get(r.ma_chuan) ?? [];
    arr.push(r);
    nhom.set(r.ma_chuan, arr);
  }

  const co: SanPhamGop[] = [];
  const moi: SanPhamGop[] = [];
  const loaiTru: SanPhamGop[] = [];

  for (const [ma, g] of nhom) {
    const coMt = g.filter((r) => !r.moi);
    const ssMoi = g.filter((r) => r.moi);
    const sp: SanPhamGop = {
      ma_chuan: ma,
      ten: g[0].ten_san_pham ?? ma,
      th_ky_truoc: coMt.reduce((s, r) => s + r.th_ky_truoc, 0),
      muc_tieu: coMt.reduce((s, r) => s + (r.muc_tieu ?? 0), 0),
      th_ky_nay: coMt.reduce((s, r) => s + r.th_ky_nay, 0),
      thNgoai: ssMoi.reduce((s, r) => s + r.th_ky_nay, 0),
      loai_tru: coMt.some((r) => r.loai_tru),
      ghi_chu: coMt.find((r) => r.ghi_chu)?.ghi_chu ?? null,
      theoSs: coMt,
      ssMoi,
    };
    if (coMt.length === 0) moi.push(sp);
    else if (sp.loai_tru) loaiTru.push(sp);
    else co.push(sp);
  }

  co.sort((a, b) => b.th_ky_truoc - a.th_ky_truoc || a.ten.localeCompare(b.ten));
  moi.sort((a, b) => b.thNgoai - a.thNgoai || a.ten.localeCompare(b.ten));
  loaiTru.sort((a, b) => a.ten.localeCompare(b.ten));
  return { co, moi, loaiTru };
}
