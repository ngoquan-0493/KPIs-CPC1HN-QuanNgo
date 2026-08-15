import { createClient } from "@/lib/supabase/server";
import MoMoiSpttDetail from "@/components/mo-moi-sptt-detail";
import CodeMoiDetail from "@/components/code-moi-detail";
import MonthSelector from "@/components/month-selector";
import SsFilter from "@/components/ss-filter";
import NvFilter from "@/components/nv-filter";
import { formatVnd } from "@/lib/sales-channel";
import { ghepTenMa, hienThiKhach } from "@/lib/display";
import { Card, PageHeader, EmptyState, Avatar, Badge } from "@/components/ui";
import { IconClock, IconUsers } from "@/components/icons";
import { getCurrentEmployee } from "@/lib/current-employee";
import KpiTabs from "@/components/kpi-tabs";
import KpiXayDung from "@/components/kpi-xay-dung";
import KpiDuyet from "@/components/kpi-duyet";
import {
  layDanhSachKpiTheoThang,
  layTatCaKpiTheoThang,
  layTenKhachTheoMa,
} from "./build-actions";

type KpiRow = {
  "Mã Nhân viên": string;
  "Tên Nhân viên": string | null;
  "Chỉ tiêu": string | null;
  "Chi tiết Kế hoạch/sản phẩm": string | null;
  "Mã khách": string | null;
  "Số lượng khách hàng kế hoạch": number | null;
  "Sản lượng kế hoạch tối thiểu": number | null;
  "Số lượng thực hiện": number | null;
  "Tỉ trọng thực hiện/kế hoạch": number | null;
  "Điểm KPIs": number | null;
  "Điểm KPIs kế hoạch": number | null;
  "Số lượng tối thiểu cần đạt": number | null;
  "Kết quả": string | null;
  "Tháng đánh giá": string;
};

type EmployeeRow = {
  "Mã nhân viên": string;
  "Tên nhân viên": string | null;
  "Vị trí": string | null;
  SS: string | null;
};

type PhanLoaiRow = {
  thang_danh_gia: string | null;
  ma_nhan_vien: string | null;
  ma_khach: string | null;
  ten_khach: string | null;
  ten_san_pham: string | null;
  don_gan_nhat: string | null;
  muc_do_canh_bao: string | null;
};

// Ket qua tra ve tu RPC get_kpi_market_activity/get_kpi_last_visit (Postgres
// function) - thay the viec tai TOAN BO dong cham cong/doanh so tho cua
// thang ve JS de tu dem/gop, gio Postgres tong hop san. Xem migration
// "add_kpi_market_activity_rpc" / "split_kpi_market_activity_and_last_visit_rpc".
type MarketActivityRow = { code: string; calls: number; khach: number };
type VisitCountRow = { code: string; ma_khach: string; so_lan: number };
type LapDonKeyRow = { code: string; ma_khach: string; san_pham: string };
type LastVisitRow = { code: string; ma_khach: string; last_checkin: string };
type KpiMarketActivity = {
  source: "tong" | "hien_tai";
  market_activity: MarketActivityRow[];
  visit_count: VisitCountRow[];
  da_lap_don: LapDonKeyRow[];
};

// thang_danh_gia in phan_loai_khach_hang_can_lap_don is text like "T6/2026";
// parse to a sortable number so the newest analysis month can be picked.
function parseThangDanhGia(v: string | null) {
  const m = /^T(\d{1,2})\/(\d{4})$/.exec((v ?? "").trim());
  if (!m) return 0;
  return Number(m[2]) * 12 + Number(m[1]);
}

const CANH_BAO_ORDER: Record<string, number> = { "Khẩn": 0, "Ưu tiên": 1, "Mồ côi": 2 };

const CHI_TIEU_ORDER: Record<string, number> = {
  "Code mới": 0,
  "Mở mới SPTT": 1,
  "Mở mới": 2,
  "Duy trì SPTT": 3,
  "Duy trì": 4,
  "Doanh số kê đơn - phòng mạch": 5,
  "Doanh số thầu": 6,
};

function canhBaoBadge(mucDo: string | null) {
  if (mucDo === "Khẩn") return "bg-red-100 text-red-700";
  if (mucDo === "Ưu tiên") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-600";
}

function ketQuaThucHienBadge(kq: string) {
  if (kq === "Đã lặp đơn") return "bg-emerald-100 text-emerald-700";
  if (kq.startsWith("Đã viếng thăm")) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function resultColor(ketQua: string | null) {
  if (!ketQua) return "bg-slate-100 text-slate-700";
  const k = ketQua.toLowerCase();
  if (k.includes("đạt") && !k.includes("không")) return "bg-emerald-100 text-emerald-700";
  if (k.includes("không đạt")) return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

// Employee codes are entered inconsistently across tables (zero-padded vs not),
// so normalize to digits-only before matching KPI rows to employees.
function normCode(code: string | null | undefined) {
  return (code ?? "").replace(/\D/g, "").replace(/^0+/, "") || code || "";
}

const DOANH_SO_CHI_TIEU = ["Doanh số kê đơn - phòng mạch", "Doanh số thầu"];

function isDoanhSoChiTieu(chiTieu: string | null) {
  return DOANH_SO_CHI_TIEU.includes(chiTieu ?? "");
}

// "Kế hoạch" hiển thị khác nhau tuỳ chỉ tiêu: Code mới/Mở mới SPTT tính theo
// số khách hàng kế hoạch, Duy trì SPTT tính theo sản lượng kế hoạch tối thiểu,
// Doanh số kê đơn - phòng mạch/Doanh số thầu đọc số tiền kế hoạch từ cột
// "Chi tiết Kế hoạch/sản phẩm" (nhập trực tiếp dạng số, vd "210000000").
function planValue(k: KpiRow) {
  if (isDoanhSoChiTieu(k["Chỉ tiêu"])) {
    const n = Number(k["Chi tiết Kế hoạch/sản phẩm"]);
    return Number.isFinite(n) ? n : null;
  }
  if (k["Chỉ tiêu"] === "Duy trì SPTT" || k["Chỉ tiêu"] === "Duy trì") {
    return k["Sản lượng kế hoạch tối thiểu"];
  }
  return k["Số lượng khách hàng kế hoạch"];
}

function isDat(ketQua: string | null) {
  const k = (ketQua ?? "").toLowerCase();
  return k.includes("đạt") && !k.includes("không");
}

// Gioi han diem thuc hien toi da theo % so voi diem ke hoach - dong bo voi
// cong thuc trong workflow n8n "09b Tong Hop Diem KPI" (xem per_group_adj).
// KHONG duoc doi 1 ben ma khong doi ben con lai, hai noi phai luon khop nhau.
const TRAN_DIEM: Record<string, number> = {
  "Code mới": 1.5,
  "Mở mới SPTT": 1.5,
  "Mở mới": 1.5,
  "Duy trì SPTT": 1.5,
  "Duy trì": 1.5,
  "Doanh số thầu": 1.2,
  // "Doanh số kê đơn - phòng mạch": khong gioi han (khong co trong bang nay).
};

// Tổng kết cho "Code mới" — cộng dồn điểm kế hoạch/thực tế từng dòng, GIỚI
// HẠN điểm thực tế tối đa theo TRAN_DIEM (150%). Khác với "Mở mới"/"Mở mới
// SPTT"/"Duy trì"/"Duy trì SPTT" (xem nguongNhomSummary bên dưới): "Code mới"
// không có ngưỡng hoàn thành nhóm, "Điểm KPIs kế hoạch" là điểm RIÊNG từng
// dòng (từng khách hàng mới) nên cộng dồn là đúng.
function chiTieuSummary(kpis: KpiRow[], chiTieu: string) {
  const rows = kpis.filter((k) => k["Chỉ tiêu"] === chiTieu);
  if (rows.length === 0) return null;

  const tongSoChiTieu = rows.length;
  const soDat = rows.filter((r) => isDat(r["Kết quả"])).length;
  const tongDiemKeHoach = rows.reduce((s, r) => s + (r["Điểm KPIs kế hoạch"] ?? 0), 0);
  const tongDiemThucTeRaw = rows.reduce((s, r) => s + (r["Điểm KPIs"] ?? 0), 0);
  const tran = TRAN_DIEM[chiTieu];
  const tongDiemThucTe = tran != null ? Math.min(tongDiemThucTeRaw, tongDiemKeHoach * tran) : tongDiemThucTeRaw;

  return { tongSoChiTieu, soDat, tongDiemKeHoach, tongDiemThucTe };
}

// Tổng kết cho 2 chỉ tiêu doanh số (Doanh số kê đơn - phòng mạch / Doanh số
// thầu) — kế hoạch đọc từ "Chi tiết Kế hoạch/sản phẩm" (nhập số tiền trực
// tiếp), thực hiện/điểm lấy từ "Số lượng thực hiện"/"Điểm KPIs" đã tính.
// Doanh số thầu giới hạn điểm thực tế tối đa 120% (TRAN_DIEM), Doanh số kê
// đơn - phòng mạch không giới hạn.
function doanhSoSummary(kpis: KpiRow[], chiTieu: string) {
  const row = kpis.find((k) => k["Chỉ tiêu"] === chiTieu);
  if (!row) return null;

  const keHoach = Number(row["Chi tiết Kế hoạch/sản phẩm"]) || 0;
  const thucHien = row["Số lượng thực hiện"] ?? 0;
  const diemKeHoach = row["Điểm KPIs kế hoạch"] ?? 0;
  const tran = TRAN_DIEM[chiTieu];
  const diemThucTe = tran != null ? Math.min(row["Điểm KPIs"] ?? 0, diemKeHoach * tran) : (row["Điểm KPIs"] ?? 0);

  return { keHoach, thucHien, diemKeHoach, diemThucTe, dat: isDat(row["Kết quả"]) };
}

// "Mở mới SPTT" / "Mở mới" / "Duy trì SPTT" / "Duy trì": Điểm KPIs kế hoạch
// là 1 con số TỔNG cho cả nhóm (giống nhau trên mọi dòng sản phẩm, không
// cộng dồn/sum như "Code mới" - đã xác nhận qua dữ liệu thực tế ngày
// 15/8/2026: "Mở mới"/"Mở mới SPTT" cũng lặp lại "Số lượng tối thiểu cần
// đạt"/"Điểm KPIs kế hoạch" y hệt trên mọi dòng, cùng cấu trúc với "Duy
// trì"/"Duy trì SPTT"). Điểm thực hiện = (điểm kế hoạch nhóm / ngưỡng hoàn
// thành nhóm) * số chỉ tiêu đạt được, giới hạn tối đa 150% điểm kế hoạch
// nhóm (TRAN_DIEM) - đồng bộ với công thức trong workflow n8n "09b Tong Hop
// Diem KPI" (per_group_adj). Nếu CHƯA đặt ngưỡng hoàn thành nhóm: tạm
// fallback về cộng dồn điểm thô từng dòng, không giới hạn (UI trang xây
// dựng/duyệt đã cảnh báo "Chưa đặt ngưỡng" để nhắc bổ sung).
function nguongNhomSummary(
  kpis: KpiRow[],
  chiTieu: "Mở mới SPTT" | "Mở mới" | "Duy trì SPTT" | "Duy trì",
) {
  const rows = kpis.filter((k) => k["Chỉ tiêu"] === chiTieu);
  if (rows.length === 0) return null;

  const tongSoChiTieu = rows.length;
  const soDat = rows.filter((r) => isDat(r["Kết quả"])).length;
  const nguong = rows.find((r) => r["Số lượng tối thiểu cần đạt"] != null)?.[
    "Số lượng tối thiểu cần đạt"
  ] ?? null;
  // Diem ke hoach NHOM la 1 gia tri duy nhat (giong nhau moi dong) - lay gia
  // tri lon nhat tim thay thay vi cong don, khac voi chiTieuSummary o tren.
  const diemKeHoachNhom = rows.reduce((max, r) => Math.max(max, r["Điểm KPIs kế hoạch"] ?? 0), 0);
  const tongDiemThucTeRaw = rows.reduce((s, r) => s + (r["Điểm KPIs"] ?? 0), 0);
  const hoanThanh = nguong != null && soDat >= nguong;

  const diemTong =
    nguong != null && nguong > 0
      ? Math.min((diemKeHoachNhom / nguong) * soDat, diemKeHoachNhom * TRAN_DIEM[chiTieu])
      : tongDiemThucTeRaw;

  return {
    tongSoChiTieu,
    soDat,
    nguong,
    hoanThanh,
    diemTong,
    tongDiemKeHoach: diemKeHoachNhom,
  };
}

export default async function KpiPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; ss?: string; nv?: string; tab?: string }>;
}) {
  const supabase = await createClient();
  const { thang, ss: selectedSs, nv: selectedNv, tab: tabParam } = await searchParams;

  const currentEmployee = await getCurrentEmployee();
  const viTriHienTai = currentEmployee?.["Vị trí"] ?? null;
  const laQuanLy = viTriHienTai === "SS" || viTriHienTai === "ASM";
  const tab = (tabParam === "xay-dung" || (tabParam === "duyet" && laQuanLy)) ? tabParam : "tien-do";

  if (tab === "xay-dung" || tab === "duyet") {
    let danhSachNv: { code: string; name: string }[] | undefined;
    if (laQuanLy) {
      const { data: empData } = await supabase
        .from("Danh sach nhan vien")
        .select("ma_nhan_vien,ten_nhan_vien")
        .neq("vi_tri", "ASM")
        .order("ten_nhan_vien", { ascending: true });
      // QUAN TRONG: giu NGUYEN ma_nhan_vien tu "Danh sach nhan vien" (KHONG
      // strip so 0 dau) - day la ma se duoc dung lam gia tri "ma_nhan_vien"
      // khi SS/ASM tao/sua KPI thay cho NV (xem "Xay dung cho nhan vien" o
      // kpi-xay-dung.tsx). Neu strip so 0 o day, dong KPI se bi ghi voi 1 ma
      // KHAC voi ma chinh chu (vd "018074" -> "18074"), khien NV do khong
      // thay dong SS/ASM vua tao khi tu vao xem KPI cua minh - day chinh la
      // nguyen nhan da xac nhan qua du lieu thuc te (5 NV bi lech ma, 33 dong
      // KPI "lac" khoi bang cua chinh chu).
      danhSachNv = (empData ?? []).map((e) => ({
        code: e.ma_nhan_vien ?? "",
        name: e.ten_nhan_vien ?? e.ma_nhan_vien,
      }));
    }

    const now = new Date();
    const thangMacDinh = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const maNhanVienHienTai = currentEmployee?.["Mã nhân viên"] ?? "";
    const tenNhanVienHienTai = currentEmployee?.["Tên nhân viên"] ?? maNhanVienHienTai;

    return (
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="KPI" description="Xây dựng và phê duyệt chỉ tiêu KPI tháng" />
        <KpiTabs hienThiDuyet={laQuanLy} />
        {tab === "xay-dung" && maNhanVienHienTai && (
          <KpiXayDungLoader
            maNhanVien={maNhanVienHienTai}
            tenNhanVien={tenNhanVienHienTai}
            viTri={viTriHienTai}
            danhSachNv={danhSachNv}
            thangMacDinh={thangMacDinh}
          />
        )}
        {tab === "duyet" && (
          <KpiDuyetLoader thangMacDinh={thangMacDinh} danhSachNv={danhSachNv ?? []} />
        )}
      </div>
    );
  }

  const monthsRes = await supabase
    .from("Chi tieu KPIs")
    .select('"Tháng đánh giá":thang_danh_gia')
    .order("thang_danh_gia", { ascending: false });

  const months = Array.from(
    new Set((monthsRes.data ?? []).map((r) => r["Tháng đánh giá"] as string)),
  ).sort((a, b) => (a < b ? 1 : -1));

  const selectedMonth = thang && months.includes(thang) ? thang : months[0];
  const [namDanhGia, thangDanhGia] = (selectedMonth ?? "")
    .split("-")
    .map(Number);

  // Chấm công phải đúng tháng đang xem (không phải "tháng hiện tại" theo
  // đồng hồ thật) — dữ liệu 1 tháng có thể nằm ở "Du lieu cham cong 3 thang"
  // (đã lưu trữ) hoặc "Du lieu cham cong thang hien tai" (đang chạy), nên lọc
  // theo khoảng ngày và gộp cả 2 bảng, giống cách xử lý doanh số.
  const dauThang = `${namDanhGia}-${String(thangDanhGia).padStart(2, "0")}-01`;
  const [namThangSau, thangThangSau] =
    thangDanhGia === 12 ? [namDanhGia + 1, 1] : [namDanhGia, thangDanhGia + 1];
  const dauThangSau = `${namThangSau}-${String(thangThangSau).padStart(2, "0")}-01`;

  const [kpiRes, empRes, marketActivityRes, phanLoaiRes] = await Promise.all([
    supabase
      .from("Chi tieu KPIs")
      .select(
        '"Mã Nhân viên":ma_nhan_vien,"Tên Nhân viên":ten_nhan_vien,"Chỉ tiêu":chi_tieu,"Chi tiết Kế hoạch/sản phẩm":chi_tiet_ke_hoach_san_pham,"Mã khách":ma_khach,"Số lượng khách hàng kế hoạch":so_luong_khach_hang_ke_hoach,"Sản lượng kế hoạch tối thiểu":san_luong_ke_hoach_toi_thieu,"Số lượng thực hiện":so_luong_thuc_hien,"Tỉ trọng thực hiện/kế hoạch":ti_trong_thuc_hien_ke_hoach,"Điểm KPIs":diem_kpis,"Điểm KPIs kế hoạch":diem_kpis_ke_hoach,"Số lượng tối thiểu cần đạt":so_luong_toi_thieu_can_dat,"Kết quả":ket_qua,"Tháng đánh giá":thang_danh_gia',
      )
      .eq("thang_danh_gia", selectedMonth ?? ""),
    supabase
      .from("Danh sach nhan vien")
      .select('"Mã nhân viên":ma_nhan_vien,"Tên nhân viên":ten_nhan_vien,"Vị trí":vi_tri,SS:ss')
      .neq("vi_tri", "ASM")
      .order("ten_nhan_vien", { ascending: true }),
    // Tong hop cham cong/doanh so ca thang chay trong Postgres (RPC) thay vi
    // tai toan bo dong tho ve JS - xem cac ham nay trong migration.
    supabase.rpc("get_kpi_market_activity", {
      p_nam: namDanhGia ?? 0,
      p_thang: thangDanhGia ?? 0,
      p_dau_thang: dauThang,
      p_dau_thang_sau: dauThangSau,
    }),
    supabase
      .from("phan_loai_khach_hang_can_lap_don")
      .select(
        "thang_danh_gia,ma_nhan_vien,ma_khach,ten_khach,ten_san_pham,don_gan_nhat,muc_do_canh_bao",
      )
      .limit(5000),
  ]);

  const marketActivity = (marketActivityRes.data ?? null) as KpiMarketActivity | null;

  // Cặp (NV, mã khách, sản phẩm) đã phát sinh đơn hàng thực tế trong tháng
  // đang xem — dùng để biết khách "cần tập trung" nào đã được lặp đơn. Doanh
  // số theo kênh (kê đơn - phòng mạch / thầu) đã chuyển sang đọc trực tiếp từ
  // "Chi tieu KPIs" (doanhSoSummary) nên không cần tự tổng hợp lại ở đây nữa.
  const daLapDonSet = new Set<string>();
  for (const r of marketActivity?.da_lap_don ?? []) {
    daLapDonSet.add(`${r.code}|${r.ma_khach}|${r.san_pham}`);
  }

  // Số lần viếng thăm (check-in) của từng cặp (NV, mã khách) trong tháng
  // đang xem — dùng chung dữ liệu chấm công đã lọc đúng tháng ở trên.
  const visitCountThisMonth = new Map<string, number>();
  for (const r of marketActivity?.visit_count ?? []) {
    visitCountThisMonth.set(`${r.code}|${r.ma_khach}`, r.so_lan);
  }

  // Chỉ giữ kỳ phân tích mới nhất của danh sách Khẩn/Ưu tiên/Mồ côi.
  const allPhanLoai = (phanLoaiRes.data ?? []) as PhanLoaiRow[];
  const latestKy = Math.max(0, ...allPhanLoai.map((r) => parseThangDanhGia(r.thang_danh_gia)));
  const phanLoaiRows = allPhanLoai.filter(
    (r) => parseThangDanhGia(r.thang_danh_gia) === latestKy,
  );

  // Lần viếng thăm gần nhất của từng NV tại từng khách trong danh sách cần
  // tập trung — gộp bảng chấm công 3 tháng và tháng hiện tại.
  const focusCustomerCodes = Array.from(
    new Set(
      phanLoaiRows
        .map((r) => (r.ma_khach ?? "").trim().toUpperCase())
        .filter(Boolean),
    ),
  );
  const { data: lastVisitData } = await supabase.rpc("get_kpi_last_visit", {
    p_focus_ma_khach: focusCustomerCodes,
  });

  const lastVisitByKey = new Map<string, string>();
  for (const r of (lastVisitData ?? []) as LastVisitRow[]) {
    lastVisitByKey.set(`${r.code}|${r.ma_khach}`, r.last_checkin);
  }

  const phanLoaiByCode = new Map<string, PhanLoaiRow[]>();
  for (const r of phanLoaiRows) {
    const key = normCode(r.ma_nhan_vien);
    if (!key) continue;
    if (!phanLoaiByCode.has(key)) phanLoaiByCode.set(key, []);
    phanLoaiByCode.get(key)!.push(r);
  }
  for (const rows of phanLoaiByCode.values()) {
    rows.sort(
      (a, b) =>
        (CANH_BAO_ORDER[a.muc_do_canh_bao ?? ""] ?? 9) -
        (CANH_BAO_ORDER[b.muc_do_canh_bao ?? ""] ?? 9),
    );
  }

  const kpiRows = (kpiRes.data ?? []) as KpiRow[];
  const employees = (empRes.data ?? []) as EmployeeRow[];

  // "Chi tieu KPIs" chi co ma_khach, khong co ten_khach - tra rieng tu
  // khach_hang_master de hien cap Ten (Ma) trong bang chi tieu, thay vi chi
  // hien mot chuoi ma kho tra cuu.
  const kpiMaKhachList = Array.from(
    new Set(kpiRows.map((k) => (k["Mã khách"] ?? "").trim()).filter(Boolean)),
  );
  const tenKhachByMa = new Map<string, string>();
  if (kpiMaKhachList.length > 0) {
    const { data: khachMasterData } = await supabase
      .from("khach_hang_master")
      .select("ma_khach,ten_khach")
      .in("ma_khach", kpiMaKhachList);
    for (const k of (khachMasterData ?? []) as { ma_khach: string; ten_khach: string | null }[]) {
      if (k.ten_khach) tenKhachByMa.set(k.ma_khach, k.ten_khach);
    }
  }

  const error = kpiRes.error ?? empRes.error ?? marketActivityRes.error ?? phanLoaiRes.error;

  // Hoạt động thị trường trong tháng đang xem (selectedMonth, không phải
  // tháng hiện tại theo đồng hồ) theo NV: số call (lượt chấm công) và số
  // khách hàng đã viếng thăm (đếm mã khách duy nhất) - da loai tru check-in
  // tai Van phong ("VP...") ngay trong RPC get_kpi_market_activity.
  const chamCongByCode = new Map<string, { calls: number; khach: number }>();
  for (const r of marketActivity?.market_activity ?? []) {
    chamCongByCode.set(r.code, { calls: r.calls, khach: r.khach });
  }

  const kpiByCode = new Map<string, KpiRow[]>();
  for (const r of kpiRows) {
    const key = normCode(r["Mã Nhân viên"]);
    if (!kpiByCode.has(key)) kpiByCode.set(key, []);
    kpiByCode.get(key)!.push(r);
  }
  for (const rows of kpiByCode.values()) {
    rows.sort(
      (a, b) =>
        (CHI_TIEU_ORDER[a["Chỉ tiêu"] ?? ""] ?? 9) -
        (CHI_TIEU_ORDER[b["Chỉ tiêu"] ?? ""] ?? 9),
    );
  }

  const ssList = Array.from(new Set(employees.map((e) => e.SS).filter((v): v is string => !!v))).sort(
    (a, b) => a.localeCompare(b),
  );
  let scopedEmployees = selectedSs ? employees.filter((e) => e.SS === selectedSs) : employees;
  const employeeOptions = scopedEmployees
    .map((e) => ({ code: normCode(e["Mã nhân viên"]), name: e["Tên nhân viên"] ?? e["Mã nhân viên"] }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (selectedNv) {
    scopedEmployees = scopedEmployees.filter((e) => normCode(e["Mã nhân viên"]) === selectedNv);
  }

  const groups = scopedEmployees.map((e) => ({
    code: normCode(e["Mã nhân viên"]),
    name: e["Tên nhân viên"] ?? e["Mã nhân viên"],
    kpis: kpiByCode.get(normCode(e["Mã nhân viên"])) ?? [],
    soCall: chamCongByCode.get(normCode(e["Mã nhân viên"]))?.calls ?? 0,
    soKhach: chamCongByCode.get(normCode(e["Mã nhân viên"]))?.khach ?? 0,
    focus: phanLoaiByCode.get(normCode(e["Mã nhân viên"])) ?? [],
  }));

  function formatVisit(iso: string | undefined) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <PageHeader
        title="Tiến độ KPI"
        description={selectedMonth ? `Kỳ đánh giá: ${selectedMonth}` : undefined}
        actions={
          <>
            {ssList.length > 0 && <SsFilter ssList={ssList} />}
            {employeeOptions.length > 0 && <NvFilter employees={employeeOptions} />}
            {months.length > 0 && selectedMonth && (
              <MonthSelector months={months} selected={selectedMonth} />
            )}
          </>
        }
      />

      <KpiTabs hienThiDuyet={laQuanLy} />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Lỗi tải dữ liệu: {error.message}
        </p>
      )}

      {groups.length === 0 && !error && (
        <EmptyState>Không có nhân viên trong phạm vi của bạn.</EmptyState>
      )}

      <div className="space-y-6">
        {groups.map(({ code, name, kpis, soCall, soKhach, focus }) => {
          const codeMoi = chiTieuSummary(kpis, "Code mới");
          const moiMoiSptt = nguongNhomSummary(kpis, "Mở mới SPTT");
          const moiMoi = nguongNhomSummary(kpis, "Mở mới");
          const duyTriSptt = nguongNhomSummary(kpis, "Duy trì SPTT");
          const duyTri = nguongNhomSummary(kpis, "Duy trì");
          const doanhSoKeDonPMKpi = doanhSoSummary(kpis, "Doanh số kê đơn - phòng mạch");
          const doanhSoThauKpi = doanhSoSummary(kpis, "Doanh số thầu");
          return (
          <Card key={code} padding="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={name ?? code} />
                <h2 className="text-sm font-semibold text-slate-900">{ghepTenMa(name, code)}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">
                  <IconClock className="h-3 w-3" /> {soCall} call
                </Badge>
                <Badge tone="brand">
                  <IconUsers className="h-3 w-3" /> {soKhach} khách đã thăm
                </Badge>
              </div>
            </div>
            {(doanhSoKeDonPMKpi ||
              doanhSoThauKpi ||
              codeMoi ||
              moiMoiSptt ||
              moiMoi ||
              duyTriSptt ||
              duyTri) && (
              <div className="mb-3 overflow-x-auto">
                <table className="data-table w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-1.5 pr-3 font-medium">Chỉ tiêu</th>
                      <th className="py-1.5 pr-3 font-medium">Thực hiện / Kế hoạch</th>
                      <th className="py-1.5 font-medium">Điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doanhSoKeDonPMKpi && (
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 pr-3 text-slate-900">
                          Doanh số kê đơn - phòng mạch
                        </td>
                        <td className="py-1.5 pr-3 text-slate-700">
                          {formatVnd(doanhSoKeDonPMKpi.thucHien)} /{" "}
                          {formatVnd(doanhSoKeDonPMKpi.keHoach)}
                        </td>
                        <td className="py-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${
                              doanhSoKeDonPMKpi.dat
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {doanhSoKeDonPMKpi.diemThucTe}/{doanhSoKeDonPMKpi.diemKeHoach}
                          </span>
                        </td>
                      </tr>
                    )}
                    {doanhSoThauKpi && (
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 pr-3 text-slate-900">Doanh số thầu</td>
                        <td className="py-1.5 pr-3 text-slate-700">
                          {formatVnd(doanhSoThauKpi.thucHien)} /{" "}
                          {formatVnd(doanhSoThauKpi.keHoach)}
                        </td>
                        <td className="py-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${
                              doanhSoThauKpi.dat
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {doanhSoThauKpi.diemThucTe}/{doanhSoThauKpi.diemKeHoach}
                          </span>
                        </td>
                      </tr>
                    )}
                    {codeMoi && (
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 pr-3 text-slate-900">Code mới</td>
                        <td className="py-1.5 pr-3 text-slate-700">
                          {codeMoi.soDat}/{codeMoi.tongSoChiTieu} chỉ tiêu đạt
                        </td>
                        <td className="py-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${
                              codeMoi.soDat === codeMoi.tongSoChiTieu
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {codeMoi.tongDiemThucTe}/{codeMoi.tongDiemKeHoach}
                          </span>
                        </td>
                      </tr>
                    )}
                    {moiMoiSptt && (
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 pr-3 text-slate-900">Mở mới SPTT</td>
                        <td className="py-1.5 pr-3 text-slate-700">
                          {moiMoiSptt.soDat}/{moiMoiSptt.tongSoChiTieu} chỉ tiêu đạt
                          {moiMoiSptt.nguong != null && ` (ngưỡng: ${moiMoiSptt.nguong})`}
                          {moiMoiSptt.hoanThanh && (
                            <span className="ml-1 font-semibold text-emerald-700">
                              Hoàn thành 100%
                            </span>
                          )}
                        </td>
                        <td className="py-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${
                              moiMoiSptt.hoanThanh
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {moiMoiSptt.diemTong}/{moiMoiSptt.tongDiemKeHoach}
                          </span>
                        </td>
                      </tr>
                    )}
                    {moiMoi && (
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 pr-3 text-slate-900">Mở mới</td>
                        <td className="py-1.5 pr-3 text-slate-700">
                          {moiMoi.soDat}/{moiMoi.tongSoChiTieu} chỉ tiêu đạt
                          {moiMoi.nguong != null && ` (ngưỡng: ${moiMoi.nguong})`}
                          {moiMoi.hoanThanh && (
                            <span className="ml-1 font-semibold text-emerald-700">
                              Hoàn thành 100%
                            </span>
                          )}
                        </td>
                        <td className="py-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${
                              moiMoi.hoanThanh
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {moiMoi.diemTong}/{moiMoi.tongDiemKeHoach}
                          </span>
                        </td>
                      </tr>
                    )}
                    {duyTriSptt && (
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 pr-3 text-slate-900">Duy trì SPTT</td>
                        <td className="py-1.5 pr-3 text-slate-700">
                          {duyTriSptt.soDat}/{duyTriSptt.tongSoChiTieu} chỉ tiêu đạt
                          {duyTriSptt.nguong != null && ` (ngưỡng: ${duyTriSptt.nguong})`}
                          {duyTriSptt.hoanThanh && (
                            <span className="ml-1 font-semibold text-emerald-700">
                              Hoàn thành 100%
                            </span>
                          )}
                        </td>
                        <td className="py-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${
                              duyTriSptt.hoanThanh
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {duyTriSptt.diemTong}/{duyTriSptt.tongDiemKeHoach}
                          </span>
                        </td>
                      </tr>
                    )}
                    {duyTri && (
                      <tr className="border-b border-slate-100 last:border-0">
                        <td className="py-1.5 pr-3 text-slate-900">Duy trì</td>
                        <td className="py-1.5 pr-3 text-slate-700">
                          {duyTri.soDat}/{duyTri.tongSoChiTieu} chỉ tiêu đạt
                          {duyTri.nguong != null && ` (ngưỡng: ${duyTri.nguong})`}
                          {duyTri.hoanThanh && (
                            <span className="ml-1 font-semibold text-emerald-700">
                              Hoàn thành 100%
                            </span>
                          )}
                        </td>
                        <td className="py-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${
                              duyTri.hoanThanh
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {duyTri.diemTong}/{duyTri.tongDiemKeHoach}
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {kpis.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có chỉ tiêu cho kỳ này.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2 pr-3 font-medium">Chỉ tiêu</th>
                      <th className="py-2 pr-3 font-medium">Chi tiết</th>
                      <th className="py-2 pr-3 font-medium">Mã khách</th>
                      <th className="py-2 pr-3 font-medium">Kế hoạch</th>
                      <th className="py-2 pr-3 font-medium">Thực hiện</th>
                      <th className="py-2 pr-3 font-medium">% Đạt</th>
                      <th className="py-2 pr-3 font-medium">Điểm</th>
                      <th className="py-2 font-medium">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.map((k, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 text-slate-900">{k["Chỉ tiêu"]}</td>
                        <td className="py-2 pr-3 text-slate-500">
                          {k["Chi tiết Kế hoạch/sản phẩm"] ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-slate-700">
                          {k["Mã khách"]
                            ? hienThiKhach(tenKhachByMa.get(k["Mã khách"]), k["Mã khách"])
                            : "—"}
                        </td>
                        <td className="py-2 pr-3 text-slate-700">
                          {planValue(k) != null
                            ? isDoanhSoChiTieu(k["Chỉ tiêu"])
                              ? formatVnd(planValue(k)!)
                              : planValue(k)
                            : "—"}
                        </td>
                        <td className="py-2 pr-3 text-slate-700">
                          {k["Số lượng thực hiện"] != null
                            ? isDoanhSoChiTieu(k["Chỉ tiêu"])
                              ? formatVnd(k["Số lượng thực hiện"])
                              : k["Số lượng thực hiện"]
                            : "—"}
                        </td>
                        <td className="py-2 pr-3 text-slate-700">
                          {k["Tỉ trọng thực hiện/kế hoạch"] != null
                            ? `${(k["Tỉ trọng thực hiện/kế hoạch"] * 100).toFixed(0)}%`
                            : "—"}
                        </td>
                        <td className="py-2 pr-3 text-slate-700">{k["Điểm KPIs"] ?? "—"}</td>
                        <td className="py-2">
                          {k["Chỉ tiêu"] === "Mở mới SPTT" ? (
                            <MoMoiSpttDetail
                              maNhanVien={k["Mã Nhân viên"]}
                              sanPham={k["Chi tiết Kế hoạch/sản phẩm"] ?? ""}
                              ketQua={k["Kết quả"] ?? ""}
                              thangDanhGia={k["Tháng đánh giá"]}
                            />
                          ) : k["Chỉ tiêu"] === "Mở mới" ? (
                            <MoMoiSpttDetail
                              maNhanVien={k["Mã Nhân viên"]}
                              sanPham={k["Chi tiết Kế hoạch/sản phẩm"] ?? ""}
                              ketQua={k["Kết quả"] ?? ""}
                              thangDanhGia={k["Tháng đánh giá"]}
                              table="chi_tiet_mo_moi"
                            />
                          ) : k["Chỉ tiêu"] === "Code mới" ? (
                            <CodeMoiDetail
                              maNhanVien={k["Mã Nhân viên"]}
                              ketQua={k["Kết quả"] ?? ""}
                              thangDanhGia={k["Tháng đánh giá"]}
                            />
                          ) : (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${resultColor(
                                k["Kết quả"],
                              )}`}
                            >
                              {k["Kết quả"] || "Chưa tính"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {focus.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <h3 className="mb-2 text-xs font-semibold text-slate-900">
                  Khách hàng cần tập trung trong tháng
                </h3>
                <div className="overflow-x-auto">
                  <table className="data-table w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-1.5 pr-3 font-medium">Mức độ</th>
                        <th className="py-1.5 pr-3 font-medium">Khách hàng</th>
                        <th className="py-1.5 pr-3 font-medium">Sản phẩm</th>
                        <th className="py-1.5 pr-3 font-medium">Lấy hàng gần nhất</th>
                        <th className="py-1.5 pr-3 font-medium">Viếng thăm gần nhất</th>
                        <th className="py-1.5 font-medium">Kết quả thực hiện</th>
                      </tr>
                    </thead>
                    <tbody>
                      {focus.map((f, i) => {
                        const maKhachNorm = (f.ma_khach ?? "").trim().toUpperCase();
                        const sanPhamNorm = (f.ten_san_pham ?? "").trim().toLowerCase();
                        const visit = formatVisit(lastVisitByKey.get(`${code}|${maKhachNorm}`));
                        const soLanVieng = visitCountThisMonth.get(`${code}|${maKhachNorm}`) ?? 0;
                        const ketQuaThucHien = daLapDonSet.has(
                          `${code}|${maKhachNorm}|${sanPhamNorm}`,
                        )
                          ? "Đã lặp đơn"
                          : soLanVieng > 0
                            ? `Đã viếng thăm ${soLanVieng} lần trong tháng ${thangDanhGia}`
                            : "Chưa viếng thăm";
                        return (
                          <tr key={i} className="border-b border-slate-100 last:border-0">
                            <td className="py-1.5 pr-3">
                              <span
                                className={`rounded-full px-2 py-0.5 font-medium ${canhBaoBadge(
                                  f.muc_do_canh_bao,
                                )}`}
                              >
                                {f.muc_do_canh_bao || "—"}
                              </span>
                            </td>
                            <td className="py-1.5 pr-3 text-slate-900">
                              {f.ten_khach || f.ma_khach || "—"}
                              {f.ma_khach && (
                                <span className="ml-1 text-slate-400">
                                  ({(f.ma_khach ?? "").toUpperCase()})
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-700">
                              {f.ten_san_pham ?? "—"}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-700">
                              {f.don_gan_nhat || "—"}
                            </td>
                            <td className="py-1.5 pr-3">
                              {visit ? (
                                <span className="text-slate-700">{visit}</span>
                              ) : (
                                <span className="text-red-600">Chưa từng viếng thăm</span>
                              )}
                            </td>
                            <td className="py-1.5">
                              <span
                                className={`rounded-full px-2 py-0.5 font-medium ${ketQuaThucHienBadge(
                                  ketQuaThucHien,
                                )}`}
                              >
                                {ketQuaThucHien}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
          );
        })}
      </div>
    </div>
  );
}

async function KpiXayDungLoader({
  maNhanVien,
  tenNhanVien,
  viTri,
  danhSachNv,
  thangMacDinh,
}: {
  maNhanVien: string;
  tenNhanVien: string;
  viTri: string | null;
  danhSachNv?: { code: string; name: string }[];
  thangMacDinh: string;
}) {
  const rows = await layDanhSachKpiTheoThang(maNhanVien, thangMacDinh);
  const maKhachList = rows.map((r) => r.ma_khach).filter((v): v is string => !!v);
  const tenKhach = maKhachList.length > 0 ? await layTenKhachTheoMa(maKhachList) : {};

  return (
    <KpiXayDung
      maNhanVien={maNhanVien}
      tenNhanVien={tenNhanVien}
      viTri={viTri}
      danhSachNv={danhSachNv}
      thangBanDau={thangMacDinh}
      rowsBanDau={rows}
      tenKhachBanDau={tenKhach}
    />
  );
}

async function KpiDuyetLoader({
  thangMacDinh,
  danhSachNv,
}: {
  thangMacDinh: string;
  danhSachNv: { code: string; name: string }[];
}) {
  const groups = await layTatCaKpiTheoThang(thangMacDinh);
  const maKhachList = groups.flatMap((g) => g.rows.map((r) => r.ma_khach)).filter((v): v is string => !!v);
  const tenKhach = maKhachList.length > 0 ? await layTenKhachTheoMa(maKhachList) : {};
  const tenNhanVienMap: Record<string, string> = {};
  for (const nv of danhSachNv) tenNhanVienMap[nv.code] = nv.name;

  // danhSachNv loai ASM (chi de chon "xay KPI thay cho NV nao" o tab Xay
  // dung) - nhung mot dong KPI van co the dung ma_nhan_vien cua chinh
  // SS/ASM (vd tu tao de test), khien nhom do khong tim thay ten trong
  // tenNhanVienMap va chi hien mai ma. Bu them bang cach tra truc tiep
  // TAT CA ma_nhan_vien thuc su xuat hien trong du lieu, khong loc vi_tri.
  const maNvTrongDuLieu = Array.from(
    new Set(groups.map((g) => g.ma_nhan_vien).filter((ma) => !(ma in tenNhanVienMap))),
  );
  if (maNvTrongDuLieu.length > 0) {
    const supabase = await createClient();
    const { data: nvData } = await supabase
      .from("Danh sach nhan vien")
      .select("ma_nhan_vien,ten_nhan_vien")
      .in("ma_nhan_vien", maNvTrongDuLieu);
    // So khop theo ma DA CHUAN HOA (bo so 0 dau) vi ma_nhan_vien luu trong
    // "Chi tieu KPIs" co the o dang khong chuan hoa (vd SS/ASM tu tao dong
    // cho chinh minh dung nguyen "Mã nhân viên" tho, con dong tao thay cho
    // NV khac qua danhSachNv thi da chuan hoa) - roi gan lai DUNG theo key
    // tho (g.ma_nhan_vien) de khop voi cach kpi-duyet.tsx tra cuu.
    const tenTheoMaChuanHoa = new Map<string, string>();
    for (const nv of nvData ?? []) {
      const chuanHoa = (nv.ma_nhan_vien ?? "").replace(/\D/g, "").replace(/^0+/, "") || nv.ma_nhan_vien;
      if (chuanHoa) tenTheoMaChuanHoa.set(chuanHoa, nv.ten_nhan_vien ?? nv.ma_nhan_vien);
    }
    for (const maTho of maNvTrongDuLieu) {
      const chuanHoa = maTho.replace(/\D/g, "").replace(/^0+/, "") || maTho;
      const ten = tenTheoMaChuanHoa.get(chuanHoa);
      if (ten) tenNhanVienMap[maTho] = ten;
    }
  }

  return (
    <KpiDuyet
      thangBanDau={thangMacDinh}
      groupsBanDau={groups}
      tenNhanVienMap={tenNhanVienMap}
      tenKhachBanDau={tenKhach}
    />
  );
}
