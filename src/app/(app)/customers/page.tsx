import { createClient } from "@/lib/supabase/server";
import {
  fetchAllRows,
  formatVnd,
  normalizeChannel,
  isExcludedSaleRow,
  preferClosedMonthRows,
} from "@/lib/sales-channel";
import { ghepTenMa } from "@/lib/display";
import { getCurrentEmployee } from "@/lib/current-employee";
import SsFilter from "@/components/ss-filter";
import NvFilter from "@/components/nv-filter";
import SearchInput from "@/components/search-input";
import CustomerProductDetail from "@/components/customer-product-detail";
import CustomersTabs from "@/components/customers-tabs";
import TheoDoiSection from "./theo-doi-section";
import { Card, PageHeader, Badge, EmptyState, StatCard } from "@/components/ui";
import { IconUsers, IconAlert, IconClock } from "@/components/icons";

type KhachHangRow = {
  ma_khach: string;
  ten_khach: string | null;
  tinh: string | null;
  nhom_khach_hang: string | null;
  kenh: string | null;
  trang_thai: string | null;
  ma_nhan_vien_phu_trach: string | null;
  ma_ss_phu_trach: string | null;
  ngay_mua_gan_nhat: string | null;
  ngay_tuong_tac_gan_nhat: string | null;
  next_action: string | null;
  ngay_follow_up_tiep_theo: string | null;
};

type NhipRow = {
  ma_khach: string;
  trang_thai_nhip: string | null;
  muc_do_rui_ro: string | null;
  so_cong_viec_qua_han: number | null;
};

type SummaryRow = { ma_khach: string; tong_doanh_thu: number | null; so_san_pham_da_mua: number | null };

type EmployeeRow = { ma_nhan_vien: string; ten_nhan_vien: string | null; ss: string | null };

type SaleAggRow = {
  ma_khach: string | null;
  doanh_thu: number | null;
  nhom_khach_hang: string | null;
  trang_thai?: string | null;
};

type CheckinRow = { ma_khach: string | null };

type LapDonRow = {
  ma_khach: string;
  muc_do_canh_bao: string | null;
  thang_danh_gia: string | null;
  ten_san_pham: string | null;
};

// Ma nhan vien nhap khong dong nhat giua cac bang (co/khong so 0 dau) - cung
// chuan hoa nhu cac trang khac (sales/kpi) truoc khi doi chieu.
function normCode(code: string | null | undefined) {
  return (code ?? "").replace(/\D/g, "").replace(/^0+/, "") || code || "";
}

const NHIP_LABEL: Record<string, string> = {
  active_followup: "Đang theo dõi",
  followup_due: "Đến hạn follow-up",
  overdue: "Quá hạn chăm sóc",
  unassigned_critical: "Chưa có người phụ trách",
  inactive: "Không hoạt động",
};

const NHIP_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active_followup: "success",
  followup_due: "warning",
  overdue: "danger",
  unassigned_critical: "danger",
  inactive: "neutral",
};

const RUI_RO_LABEL: Record<string, string> = { P1: "Cao", P2: "Trung bình", P3: "Thấp" };
const RUI_RO_TONE: Record<string, "danger" | "warning" | "info"> = { P1: "danger", P2: "warning", P3: "info" };

// "Khẩn" > "Ưu tiên" > "Mồ côi" - dung de chon muc canh bao nang nhat khi
// 1 khach co nhieu dong (nhieu san pham) can lap don trong cung thang danh gia.
const LAP_DON_ORDER: Record<string, number> = { "Khẩn": 3, "Ưu tiên": 2, "Mồ côi": 1 };
const LAP_DON_TONE: Record<string, "danger" | "warning" | "neutral"> = {
  "Khẩn": "danger",
  "Ưu tiên": "warning",
  "Mồ côi": "neutral",
};

// thang_danh_gia luu dang "T7/2026" - parse ra so de so sanh, lay thang moi
// nhat dang co trong ket qua truy van thay vi gia dinh cung thang server.
function parseThangDanhGia(s: string | null) {
  const m = (s ?? "").match(/T(\d+)\/(\d+)/);
  if (!m) return 0;
  return Number(m[2]) * 100 + Number(m[1]);
}

function tinhTongDoanhThu(rows: SaleAggRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.ma_khach || isExcludedSaleRow(r)) continue;
    map.set(r.ma_khach, (map.get(r.ma_khach) ?? 0) + (r.doanh_thu ?? 0));
  }
  return map;
}

// Mui ten so sanh doanh thu thang nay voi thang truoc cho 1 khach hang.
function renderDelta(thangNay: number, thangTruoc: number) {
  if (!thangNay && !thangTruoc) return null;
  if (!thangTruoc) {
    return <span className="text-emerald-600">▲ Mới phát sinh</span>;
  }
  const pct = ((thangNay - thangTruoc) / thangTruoc) * 100;
  if (Math.abs(pct) < 1) return <span className="text-slate-400">– Không đổi</span>;
  if (pct > 0) return <span className="text-emerald-600">▲ {pct.toFixed(0)}% so với tháng trước</span>;
  return <span className="text-red-600">▼ {Math.abs(pct).toFixed(0)}% so với tháng trước</span>;
}

const MAX_HIEN_THI = 200;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ss?: string; nv?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const selectedSs = sp.ss;
  const selectedNv = sp.nv;
  const tab = sp.tab === "theo-doi" ? "theo-doi" : "danh-sach";
  const daLoc = !!(q || selectedSs || selectedNv);

  const now = new Date();
  const nam = now.getFullYear();
  const thang = now.getMonth() + 1;
  const prevNam = thang === 1 ? nam - 1 : nam;
  const prevThang = thang === 1 ? 12 : thang - 1;

  const supabase = await createClient();
  const currentEmployee = await getCurrentEmployee();

  const [empRes, ssEmpRes, tongKhachRes, quaHanRes, chuaPhuTrachRes] = await Promise.all([
    supabase.from("Danh sach nhan vien").select("ma_nhan_vien,ten_nhan_vien,ss").in("vi_tri", ["NVKD", "TTS"]),
    // Rieng danh sach SS (ma + ten) - dung de quy doi ma_ss_phu_trach (luu o
    // khach_hang_master) sang TEN SS, roi tra ra nhom NV cua SS do khi NV goc
    // phu trach 1 khach-san pham DA BI XOA HAN khoi "Danh sach nhan vien" (nghi
    // viec), nen khong the tra cuu SS qua bang NV nhu binh thuong duoc nua.
    // Xem TheoDoiSection.
    supabase.from("Danh sach nhan vien").select("ma_nhan_vien,ten_nhan_vien").eq("vi_tri", "SS"),
    supabase.from("khach_hang_master").select("ma_khach", { count: "exact", head: true }),
    supabase
      .from("nhip_khach_hang")
      .select("ma_khach", { count: "exact", head: true })
      .eq("trang_thai_nhip", "overdue"),
    supabase
      .from("nhip_khach_hang")
      .select("ma_khach", { count: "exact", head: true })
      .eq("trang_thai_nhip", "unassigned_critical"),
  ]);

  const ssEmployees = ((ssEmpRes.data ?? []) as { ma_nhan_vien: string; ten_nhan_vien: string | null }[]).map(
    (e) => ({ code: e.ma_nhan_vien, name: e.ten_nhan_vien ?? e.ma_nhan_vien }),
  );

  const ssByCode = new Map<string, string | null>();
  const nameByCode = new Map<string, string | null>();
  // Danh sach NV DANG HOAT DONG (chi lay tu "Danh sach nhan vien" nhu empRes -
  // NV da nghi viec/doi vi tri se khong con trong danh sach nay) - dung de
  // SS/ASM giao lai 1 khach-san pham qua han cho NV KHAC trong CUNG nhom SS
  // khi NV goc phu trach da nghi viec, xem TheoDoiSection/TheoDoiToggle.
  const employees: { code: string; name: string; ss: string | null }[] = [];
  for (const e of (empRes.data ?? []) as EmployeeRow[]) {
    const code = normCode(e.ma_nhan_vien);
    ssByCode.set(code, e.ss);
    nameByCode.set(code, e.ten_nhan_vien);
    employees.push({ code: e.ma_nhan_vien, name: e.ten_nhan_vien ?? e.ma_nhan_vien, ss: e.ss });
  }
  const ssList = Array.from(new Set(Array.from(ssByCode.values()).filter((v): v is string => !!v))).sort(
    (a, b) => a.localeCompare(b),
  );
  const employeeOptions = Array.from(nameByCode.entries())
    .filter(([code]) => !selectedSs || ssByCode.get(code) === selectedSs)
    .map(([code, name]) => ({ code, name: name ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));

  let khachRows: KhachHangRow[] = [];
  let tongSoKhopBoLoc = 0;
  let error: { message: string } | null = null;

  if (daLoc) {
    const cols =
      "ma_khach,ten_khach,tinh,nhom_khach_hang,kenh,trang_thai,ma_nhan_vien_phu_trach,ma_ss_phu_trach,ngay_mua_gan_nhat,ngay_tuong_tac_gan_nhat,next_action,ngay_follow_up_tiep_theo";
    const { data, error: fetchError } = await fetchAllRows<KhachHangRow>((from, to) => {
      let query = supabase.from("khach_hang_master").select(cols).range(from, to);
      if (q) query = query.or(`ten_khach.ilike.%${q}%,ma_khach.ilike.%${q}%`);
      if (selectedSs) query = query.eq("ma_ss_phu_trach", selectedSs);
      return query;
    });
    error = fetchError;
    let rows = data;
    if (selectedNv) {
      rows = rows.filter((r) => normCode(r.ma_nhan_vien_phu_trach) === selectedNv);
    }
    rows.sort((a, b) => (a.ten_khach ?? a.ma_khach).localeCompare(b.ten_khach ?? b.ma_khach));
    tongSoKhopBoLoc = rows.length;
    khachRows = rows.slice(0, MAX_HIEN_THI);
  }

  const maKhachList = khachRows.map((r) => r.ma_khach);
  const saleCols = "ma_khach,doanh_thu,nhom_khach_hang,trang_thai";
  const [nhipRes, summaryRes, tongThangNayRes, hienTaiThangNayRes, tongThangTruocRes, checkinRes, lapDonRes] =
    await Promise.all([
      maKhachList.length > 0
        ? supabase
            .from("nhip_khach_hang")
            .select("ma_khach,trang_thai_nhip,muc_do_rui_ro,so_cong_viec_qua_han")
            .in("ma_khach", maKhachList)
        : Promise.resolve({ data: [] as NhipRow[] }),
      maKhachList.length > 0
        ? supabase
            .from("v_customer_summary")
            .select("ma_khach,tong_doanh_thu,so_san_pham_da_mua")
            .in("ma_khach", maKhachList)
        : Promise.resolve({ data: [] as SummaryRow[] }),
      // Doanh thu thang nay: du lieu thang dang chay nam trong "Du lieu sale
      // thang hien tai", cac thang da khoa so nam trong "Du lieu sale tong" -
      // truy van ca 2 bang cho ca thang nay va thang truoc de khong bo sot du
      // lieu du thang hien tai la thang nao (giong cach lam cua trang Doanh so).
      maKhachList.length > 0
        ? supabase
            .from("Du lieu sale tong")
            .select(saleCols)
            .eq("nam", nam)
            .eq("thang", thang)
            .in("ma_khach", maKhachList)
        : Promise.resolve({ data: [] as SaleAggRow[] }),
      maKhachList.length > 0
        ? supabase
            .from("Du lieu sale thang hien tai")
            .select(saleCols)
            .eq("nam", nam)
            .eq("thang", thang)
            .in("ma_khach", maKhachList)
        : Promise.resolve({ data: [] as SaleAggRow[] }),
      maKhachList.length > 0
        ? supabase
            .from("Du lieu sale tong")
            .select(saleCols)
            .eq("nam", prevNam)
            .eq("thang", prevThang)
            .in("ma_khach", maKhachList)
        : Promise.resolve({ data: [] as SaleAggRow[] }),
      // So lan ghe tham trong thang hien tai - dem so dong cham cong (moi dong
      // la 1 lan checkin) theo tung khach, khong gioi han theo ngay vi bang
      // nay chi luu du lieu thang dang chay.
      maKhachList.length > 0
        ? fetchAllRows<CheckinRow>((from, to) =>
            supabase
              .from("Du lieu cham cong thang hien tai")
              .select("ma_khach")
              .in("ma_khach", maKhachList)
              .range(from, to),
          )
        : Promise.resolve({ data: [] as CheckinRow[], error: null }),
      // Can lap don: lay thang danh gia moi nhat dang co trong bang cho danh
      // sach khach dang hien thi, khong gia dinh truoc thang cu the.
      maKhachList.length > 0
        ? supabase
            .from("phan_loai_khach_hang_can_lap_don")
            .select("ma_khach,muc_do_canh_bao,thang_danh_gia,ten_san_pham")
            .in("ma_khach", maKhachList)
        : Promise.resolve({ data: [] as LapDonRow[] }),
    ]);

  const nhipByMa = new Map<string, NhipRow>();
  for (const n of (nhipRes.data ?? []) as NhipRow[]) nhipByMa.set(n.ma_khach, n);
  const summaryByMa = new Map<string, SummaryRow>();
  for (const s of (summaryRes.data ?? []) as SummaryRow[]) summaryByMa.set(s.ma_khach, s);

  const doanhThuThangNayByMa = tinhTongDoanhThu(
    preferClosedMonthRows(
      (tongThangNayRes.data ?? []) as SaleAggRow[],
      (hienTaiThangNayRes.data ?? []) as SaleAggRow[],
    ),
  );
  const doanhThuThangTruocByMa = tinhTongDoanhThu((tongThangTruocRes.data ?? []) as SaleAggRow[]);

  const gheThamByMa = new Map<string, number>();
  for (const c of ((checkinRes as { data: CheckinRow[] | null }).data ?? []) as CheckinRow[]) {
    if (!c.ma_khach) continue;
    gheThamByMa.set(c.ma_khach, (gheThamByMa.get(c.ma_khach) ?? 0) + 1);
  }

  const lapDonRowsAll = (lapDonRes.data ?? []) as LapDonRow[];
  const thangDanhGiaMoiNhat = Math.max(0, ...lapDonRowsAll.map((r) => parseThangDanhGia(r.thang_danh_gia)));
  const lapDonByMa = new Map<string, { muc_do: string; soLuong: number }>();
  for (const r of lapDonRowsAll) {
    if (parseThangDanhGia(r.thang_danh_gia) !== thangDanhGiaMoiNhat) continue;
    const cur = lapDonByMa.get(r.ma_khach);
    if (!cur || (LAP_DON_ORDER[r.muc_do_canh_bao ?? ""] ?? 0) > (LAP_DON_ORDER[cur.muc_do] ?? 0)) {
      lapDonByMa.set(r.ma_khach, { muc_do: r.muc_do_canh_bao ?? "", soLuong: (cur?.soLuong ?? 0) + 1 });
    } else {
      lapDonByMa.set(r.ma_khach, { muc_do: cur.muc_do, soLuong: cur.soLuong + 1 });
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <PageHeader
        title="Khách hàng"
        description={
          daLoc
            ? `${tongSoKhopBoLoc.toLocaleString("vi-VN")} khách khớp bộ lọc${
                tongSoKhopBoLoc > MAX_HIEN_THI ? ` · hiển thị ${MAX_HIEN_THI} đầu tiên` : ""
              }${selectedSs ? ` · Nhóm ${selectedSs}` : ""}${
                selectedNv ? ` · NV ${ghepTenMa(nameByCode.get(selectedNv), selectedNv)}` : ""
              }`
            : "Tra cứu và tìm kiếm thông tin khách hàng theo tên, mã, nhóm SS hoặc nhân viên phụ trách"
        }
        actions={
          <>
            {ssList.length > 0 && <SsFilter ssList={ssList} />}
            {employeeOptions.length > 0 && <NvFilter employees={employeeOptions} />}
            <SearchInput placeholder="Tìm theo tên hoặc mã khách..." />
          </>
        }
      />

      <CustomersTabs />

      {tab === "theo-doi" ? (
        <TheoDoiSection
          selectedSs={selectedSs}
          selectedNv={selectedNv}
          ssByCode={ssByCode}
          employees={employees}
          ssEmployees={ssEmployees}
          viTriHienTai={currentEmployee?.["Vị trí"] ?? null}
          maNhanVienHienTai={currentEmployee?.["Mã nhân viên"] ?? null}
        />
      ) : (
        <>
      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Lỗi tải dữ liệu: {error.message}
        </p>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Tổng số khách hàng"
          value={(tongKhachRes.count ?? 0).toLocaleString("vi-VN")}
          icon={<IconUsers className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard
          label="Khách quá hạn chăm sóc"
          value={(quaHanRes.count ?? 0).toLocaleString("vi-VN")}
          icon={<IconClock className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Khách chưa có người phụ trách"
          value={(chuaPhuTrachRes.count ?? 0).toLocaleString("vi-VN")}
          icon={<IconAlert className="h-5 w-5" />}
          tone="info"
        />
      </div>

      <Card padding="p-0">
        {!daLoc && (
          <div className="p-5">
            <EmptyState>
              Nhập tên/mã khách hàng, hoặc chọn nhóm SS/nhân viên phụ trách ở trên để bắt đầu tra cứu.
            </EmptyState>
          </div>
        )}
        {daLoc && khachRows.length === 0 && (
          <div className="p-5">
            <EmptyState>Không tìm thấy khách hàng nào khớp với bộ lọc hiện tại.</EmptyState>
          </div>
        )}
        {daLoc && khachRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Khách hàng</th>
                  <th className="px-3 py-2.5 font-medium">Tỉnh</th>
                  <th className="px-3 py-2.5 font-medium">Nhóm kênh</th>
                  <th className="px-3 py-2.5 font-medium">NV phụ trách</th>
                  <th className="px-3 py-2.5 font-medium">Trạng thái nhịp</th>
                  <th className="px-3 py-2.5 font-medium">Mức độ rủi ro</th>
                  <th className="px-3 py-2.5 font-medium">Cần lặp đơn</th>
                  <th className="px-3 py-2.5 font-medium">Viếng thăm</th>
                  <th className="px-3 py-2.5 font-medium">Doanh thu tháng này</th>
                  <th className="px-4 py-2.5 font-medium">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {khachRows.map((k) => {
                  const nhip = nhipByMa.get(k.ma_khach);
                  const summary = summaryByMa.get(k.ma_khach);
                  const nvCode = normCode(k.ma_nhan_vien_phu_trach);
                  const lapDon = lapDonByMa.get(k.ma_khach);
                  const soLanGheTham = gheThamByMa.get(k.ma_khach) ?? 0;
                  const dtThangNay = doanhThuThangNayByMa.get(k.ma_khach) ?? 0;
                  const dtThangTruoc = doanhThuThangTruocByMa.get(k.ma_khach) ?? 0;
                  return (
                    <tr key={k.ma_khach} className="border-b border-slate-100 align-top last:border-0">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-900">{ghepTenMa(k.ten_khach, k.ma_khach)}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Tổng lũy kế: {formatVnd(summary?.tong_doanh_thu ?? 0)}
                        </p>
                        {k.trang_thai === "inactive" && (
                          <Badge tone="neutral" className="mt-1">
                            Ngừng hoạt động
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{k.tinh || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-700">{normalizeChannel(k.nhom_khach_hang)}</td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {k.ma_nhan_vien_phu_trach
                          ? ghepTenMa(nameByCode.get(nvCode), k.ma_nhan_vien_phu_trach)
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {nhip?.trang_thai_nhip ? (
                          <Badge tone={NHIP_TONE[nhip.trang_thai_nhip] ?? "neutral"}>
                            {NHIP_LABEL[nhip.trang_thai_nhip] ?? nhip.trang_thai_nhip}
                          </Badge>
                        ) : (
                          "—"
                        )}
                        {nhip?.so_cong_viec_qua_han ? (
                          <span className="ml-1 text-xs text-slate-400">
                            ({nhip.so_cong_viec_qua_han} việc quá hạn)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        {nhip?.muc_do_rui_ro ? (
                          <Badge tone={RUI_RO_TONE[nhip.muc_do_rui_ro] ?? "neutral"}>
                            {RUI_RO_LABEL[nhip.muc_do_rui_ro] ?? nhip.muc_do_rui_ro}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {lapDon ? (
                          <>
                            <Badge tone={LAP_DON_TONE[lapDon.muc_do] ?? "neutral"}>{lapDon.muc_do || "—"}</Badge>
                            {lapDon.soLuong > 1 && (
                              <span className="ml-1 text-xs text-slate-400">({lapDon.soLuong} SP)</span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        <p>{soLanGheTham} lần trong tháng</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Gần nhất: {k.ngay_tuong_tac_gan_nhat || "—"}
                        </p>
                        <p className="text-xs text-slate-400">Mua gần nhất: {k.ngay_mua_gan_nhat || "—"}</p>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-700">
                        <p>{formatVnd(dtThangNay)}</p>
                        <p className="mt-0.5 text-xs">{renderDelta(dtThangNay, dtThangTruoc)}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <CustomerProductDetail maKhach={k.ma_khach} />
                        {k.next_action && (
                          <p className="mt-1.5 max-w-xs text-xs text-slate-500">
                            Việc tiếp theo: {k.next_action}
                            {k.ngay_follow_up_tiep_theo ? ` (hạn ${k.ngay_follow_up_tiep_theo})` : ""}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
        </>
      )}
    </div>
  );
}
