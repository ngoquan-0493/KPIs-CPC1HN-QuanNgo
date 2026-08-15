import { createClient } from "@/lib/supabase/server";
import { formatVnd, normalizeChannel } from "@/lib/sales-channel";
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

type EmployeeRow = { ma_nhan_vien: string; ten_nhan_vien: string | null; ss: string | null };

// Mot dong ket qua tra ve tu RPC get_customers_dashboard (Postgres function) -
// toan bo phan tim kiem + lam giau du lieu (nhip cham soc, doanh thu thang
// nay/truoc, so lan ghe tham, canh bao lap don...) chay het trong Postgres
// thay vi 2 vong round-trip noi tiep (tim kiem khach hang -> roi moi 7 truy
// van rieng cho tung loai du lieu lien quan) nhu truoc day. Xem migration
// "add_customers_dashboard_rpc" / "fix_customers_dashboard_ss_filter".
type CustomerDashboardRow = {
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
  trang_thai_nhip: string | null;
  muc_do_rui_ro: string | null;
  so_cong_viec_qua_han: number | null;
  tong_doanh_thu_luy_ke: number | null;
  so_san_pham_da_mua: number | null;
  doanh_thu_thang_nay: number | null;
  doanh_thu_thang_truoc: number | null;
  so_lan_ghe_tham: number | null;
  lap_don_muc_do: string | null;
  lap_don_so_luong: number | null;
};

type CustomersDashboard = {
  source: "tong" | "hien_tai";
  stats: { tong_khach: number; qua_han: number; chua_phu_trach: number };
  total_matched: number;
  rows: CustomerDashboardRow[];
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

const LAP_DON_TONE: Record<string, "danger" | "warning" | "neutral"> = {
  "Khẩn": "danger",
  "Ưu tiên": "warning",
  "Mồ côi": "neutral",
};

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

  const [empRes, ssEmpRes] = await Promise.all([
    supabase.from("Danh sach nhan vien").select("ma_nhan_vien,ten_nhan_vien,ss").in("vi_tri", ["NVKD", "TTS"]),
    // Rieng danh sach SS (ma + ten) - dung de quy doi ten SS sang MA SS truoc
    // khi loc (khach_hang_master.ma_ss_phu_trach luu MA, khong phai TEN), va
    // tra ra nhom NV cua SS do khi NV goc phu trach 1 khach-san pham DA BI
    // XOA HAN khoi "Danh sach nhan vien" (nghi viec). Xem TheoDoiSection.
    supabase.from("Danh sach nhan vien").select("ma_nhan_vien,ten_nhan_vien").eq("vi_tri", "SS"),
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

  // Bo loc SS tren URL luu TEN SS (giong sales/page.tsx) nhung
  // khach_hang_master.ma_ss_phu_trach luu MA - quy doi qua danh sach SS
  // truoc khi goi RPC (sua loi cu: loc SS o tab Danh sach truoc day luon ra
  // 0 ket qua vi so sanh nham ten voi ma).
  const selectedSsCode = selectedSs
    ? (ssEmployees.find((e) => e.name === selectedSs)?.code ?? selectedSs)
    : null;

  const dashRes = await supabase.rpc("get_customers_dashboard", {
    p_da_loc: daLoc,
    p_q: q || null,
    p_ss: selectedSsCode,
    p_nv: selectedNv ?? null,
    p_nam: nam,
    p_thang: thang,
    p_prev_nam: prevNam,
    p_prev_thang: prevThang,
    p_limit: MAX_HIEN_THI,
  });

  const error = dashRes.error;
  const dash = (dashRes.data ?? null) as CustomersDashboard | null;
  const khachRows = dash?.rows ?? [];
  const tongSoKhopBoLoc = dash?.total_matched ?? 0;

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
          value={(dash?.stats.tong_khach ?? 0).toLocaleString("vi-VN")}
          icon={<IconUsers className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard
          label="Khách quá hạn chăm sóc"
          value={(dash?.stats.qua_han ?? 0).toLocaleString("vi-VN")}
          icon={<IconClock className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Khách chưa có người phụ trách"
          value={(dash?.stats.chua_phu_trach ?? 0).toLocaleString("vi-VN")}
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
                  const nvCode = normCode(k.ma_nhan_vien_phu_trach);
                  const dtThangNay = k.doanh_thu_thang_nay ?? 0;
                  const dtThangTruoc = k.doanh_thu_thang_truoc ?? 0;
                  return (
                    <tr key={k.ma_khach} className="border-b border-slate-100 align-top last:border-0">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-900">{ghepTenMa(k.ten_khach, k.ma_khach)}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Tổng lũy kế: {formatVnd(k.tong_doanh_thu_luy_ke ?? 0)}
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
                        {k.trang_thai_nhip ? (
                          <Badge tone={NHIP_TONE[k.trang_thai_nhip] ?? "neutral"}>
                            {NHIP_LABEL[k.trang_thai_nhip] ?? k.trang_thai_nhip}
                          </Badge>
                        ) : (
                          "—"
                        )}
                        {k.so_cong_viec_qua_han ? (
                          <span className="ml-1 text-xs text-slate-400">
                            ({k.so_cong_viec_qua_han} việc quá hạn)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        {k.muc_do_rui_ro ? (
                          <Badge tone={RUI_RO_TONE[k.muc_do_rui_ro] ?? "neutral"}>
                            {RUI_RO_LABEL[k.muc_do_rui_ro] ?? k.muc_do_rui_ro}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {k.lap_don_muc_do ? (
                          <>
                            <Badge tone={LAP_DON_TONE[k.lap_don_muc_do] ?? "neutral"}>{k.lap_don_muc_do || "—"}</Badge>
                            {(k.lap_don_so_luong ?? 0) > 1 && (
                              <span className="ml-1 text-xs text-slate-400">({k.lap_don_so_luong} SP)</span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        <p>{k.so_lan_ghe_tham ?? 0} lần trong tháng</p>
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
