import { createClient } from "@/lib/supabase/server";
import MonthSelector from "@/components/month-selector";
import SsFilter from "@/components/ss-filter";
import { formatVnd } from "@/lib/sales-channel";
import { ghepTenMa } from "@/lib/display";
import { Card, PageHeader, EmptyState, Badge, StatCard, SectionHeading } from "@/components/ui";
import { IconWallet, IconTarget, IconClock, IconChartBar } from "@/components/icons";

// Ket qua tra ve tu RPC fn_luong_thuong_thang(p_thang) (Postgres function,
// SECURITY INVOKER) - xem migration "add_luong_thuong_module". Ham nay tu
// ke thua RLS cua "Danh sach nhan vien"/tong_hop_diem_kpi_thang theo nguoi
// goi (ASM thay het team, SS thay nhom minh, NV chi thay chinh minh) - page
// nay KHONG can tu loc lai theo vi_tri/ma_ss, chi loc THEM theo SsFilter de
// ASM thu hep man hinh.
type LuongThuongRow = {
  ma_nhan_vien: string;
  ten_nhan_vien: string | null;
  vi_tri: string | null;
  ma_ss: string | null;
  ten_ss: string | null;
  ma_asm: string | null;
  loai_hop_dong: string | null;
  luong_cung: number | null;
  buoi_cong_thuc_te: number | null;
  don_gia_buoi: number | null;
  luong_thuc_nhan: number | null;
  tong_diem_ke_hoach_kpi: number | null;
  tong_diem_thuc_te_kpi: number | null;
  ty_le_dat_kpi: number | null;
  xep_loai_kpi: string | null;
  kpi_cap_nhat_luc: string | null;
  co_chi_tieu_duoi_50: boolean | null;
  dat_dieu_kien_thuong: boolean | null;
  muc_thuong_kpi: number | null;
  tong_thu_nhap_uoc_tinh: number | null;
};

// Ket qua tra ve tu RPC fn_thuong_doanhso_kdpm(p_thang) (Postgres function,
// SECURITY INVOKER) - xem migration "create_fn_thuong_doanhso_kdpm". Tinh
// thuong doanh so "Kê đơn - Phòng mạch" theo Bảng 2 chinh sach (bang
// chinh_sach_thuong_khung_doanhso), gan tren 4 truong hop (dat/khong dat
// Thuong KPIs thang x ty le dat doanh so) + M1/M2 cho SS. Ham tra ve TAT CA
// SS/NVKD dang active cho thang duoc chon, ke ca nguoi chua co du lieu -
// thieu_du_lieu/ly_do_thieu danh dau ro de UI hien "thiếu" thay vi 0 hoac
// bo qua (yeu cau cua ASM: "các mục thiếu hãy hiển thị là thiếu").
type ThuongDoanhSoRow = {
  ma_nhan_vien: string;
  ten_nhan_vien: string | null;
  vi_tri: string | null;
  chuc_danh_thuong: string | null;
  loai_hop_dong: string | null;
  ma_ss: string | null;
  ten_ss: string | null;
  thang_danh_gia: string | null;
  ngay_bat_dau: string | null;
  thang_tham_nien: number | null;
  ke_hoach: number | null;
  thuc_hien: number | null;
  ti_trong: number | null;
  tong_diem_ke_hoach: number | null;
  tong_diem_thuc_te: number | null;
  ty_le_dat_tong_kpi: number | null;
  so_chi_tieu_duoi_50: number | null;
  dat_thuong_kpis: boolean | null;
  khung_ap_dung: number | null;
  muc_thuong_ap_dung: number | null;
  m1_ss: number | null;
  ti_le_nhom_dat_kpi: number | null;
  m2_ss: number | null;
  thuong_doanh_so_cuoi_cung: number | null;
  thieu_du_lieu: boolean | null;
  ly_do_thieu: string | null;
};

const VI_TRI_ORDER: Record<string, number> = { ASM: 0, SS: 1, NVKD: 2 };
const VI_TRI_LABEL: Record<string, string> = {
  ASM: "ASM",
  SS: "SS",
  NVKD: "Nhân viên",
};

function formatPercent(v: number | null) {
  if (v == null) return "—";
  return `${(v * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

export default async function LuongThuongPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; ss?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  // Danh sach thang de chon: hop nhat cac thang da co chi tieu KPI (Chi tieu
  // KPIs) + thang hien tai theo lich thuc (de ASM van xem/nhap luong cung
  // truoc khi chi tieu KPI thang do duoc xay dung xong).
  const now = new Date();
  const thangHienTai = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthsRes = await supabase
    .from("Chi tieu KPIs")
    .select('"Tháng đánh giá":thang_danh_gia')
    .order("thang_danh_gia", { ascending: false });
  const months = Array.from(
    new Set([thangHienTai, ...(monthsRes.data ?? []).map((r) => r["Tháng đánh giá"] as string)]),
  ).sort((a, b) => (a < b ? 1 : -1));

  const selectedMonth = sp.thang && months.includes(sp.thang) ? sp.thang : months[0];

  const [{ data, error }, { data: dsData, error: dsError }] = await Promise.all([
    supabase.rpc("fn_luong_thuong_thang", { p_thang: selectedMonth }),
    supabase.rpc("fn_thuong_doanhso_kdpm", { p_thang: selectedMonth }),
  ]);

  const rows = ((data ?? []) as LuongThuongRow[]).slice();
  rows.sort((a, b) => {
    const va = VI_TRI_ORDER[a.vi_tri ?? ""] ?? 9;
    const vb = VI_TRI_ORDER[b.vi_tri ?? ""] ?? 9;
    if (va !== vb) return va - vb;
    return (a.ten_nhan_vien ?? "").localeCompare(b.ten_nhan_vien ?? "");
  });

  const dsByMa = new Map<string, ThuongDoanhSoRow>(
    ((dsData ?? []) as ThuongDoanhSoRow[]).map((r) => [r.ma_nhan_vien, r]),
  );

  const ssList = Array.from(
    new Set(rows.map((r) => r.ten_ss).filter((v): v is string => !!v)),
  ).sort((a, b) => a.localeCompare(b));

  const selectedSs = sp.ss;
  const rowsHienThi = selectedSs ? rows.filter((r) => r.ten_ss === selectedSs) : rows;

  const tongLuongCung = rowsHienThi.reduce((s, r) => s + (r.luong_thuc_nhan ?? 0), 0);
  const tongThuongKpi = rowsHienThi.reduce((s, r) => s + (r.muc_thuong_kpi ?? 0), 0);
  const tongThuongDoanhSo = rowsHienThi.reduce((s, r) => {
    const ds = dsByMa.get(r.ma_nhan_vien);
    return s + (ds?.thuong_doanh_so_cuoi_cung ?? 0);
  }, 0);
  const tongThuNhap = rowsHienThi.reduce((s, r) => {
    const ds = dsByMa.get(r.ma_nhan_vien);
    return s + (r.tong_thu_nhap_uoc_tinh ?? 0) + (ds?.thuong_doanh_so_cuoi_cung ?? 0);
  }, 0);
  const soChuaNhapLuongCung = rowsHienThi.filter((r) => r.luong_cung == null).length;
  const soThieuDoanhSo = rowsHienThi.filter((r) => {
    if (r.vi_tri !== "NVKD" && r.vi_tri !== "SS") return false;
    const ds = dsByMa.get(r.ma_nhan_vien);
    return !ds || ds.thieu_du_lieu;
  }).length;

  const kpiCapNhatLuc = rowsHienThi
    .map((r) => r.kpi_cap_nhat_luc)
    .filter((v): v is string => !!v)
    .sort()
    .at(-1);

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <PageHeader
        title="Lương - Thưởng"
        description="Lương cứng theo buổi công + thưởng KPIs + thưởng doanh số Kê đơn - Phòng mạch."
        actions={
          <>
            {months.length > 0 && selectedMonth && (
              <MonthSelector months={months} selected={selectedMonth} />
            )}
            {ssList.length > 0 && <SsFilter ssList={ssList} />}
          </>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Lỗi tải dữ liệu lương - thưởng KPIs: {error.message}
        </p>
      )}
      {dsError && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Lỗi tải dữ liệu thưởng doanh số: {dsError.message}
        </p>
      )}

      {!error && rowsHienThi.length === 0 && (
        <EmptyState>Không có dữ liệu lương - thưởng trong phạm vi của bạn cho tháng này.</EmptyState>
      )}

      {rowsHienThi.length > 0 && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Tổng lương cứng thực nhận"
              value={formatVnd(tongLuongCung)}
              icon={<IconWallet className="h-5 w-5" />}
              tone="brand"
            />
            <StatCard
              label="Tổng thưởng KPIs"
              value={formatVnd(tongThuongKpi)}
              icon={<IconTarget className="h-5 w-5" />}
              tone="success"
              hint={
                soChuaNhapLuongCung > 0
                  ? `${soChuaNhapLuongCung} người chưa nhập lương cứng`
                  : undefined
              }
            />
            <StatCard
              label="Tổng thưởng DS Kê đơn - Phòng mạch"
              value={formatVnd(tongThuongDoanhSo)}
              icon={<IconChartBar className="h-5 w-5" />}
              tone="warning"
              hint={soThieuDoanhSo > 0 ? `${soThieuDoanhSo} người thiếu dữ liệu` : undefined}
            />
            <StatCard
              label="Tổng thu nhập ước tính"
              value={formatVnd(tongThuNhap)}
              icon={<IconWallet className="h-5 w-5" />}
              tone="info"
              hint={
                soThieuDoanhSo > 0
                  ? "Chưa cộng thưởng DS của người còn thiếu dữ liệu"
                  : undefined
              }
            />
          </div>

          {kpiCapNhatLuc && (
            <p className="mb-4 flex items-center gap-1.5 text-xs text-slate-400">
              <IconClock className="h-3.5 w-3.5" />
              Dữ liệu điểm KPI cập nhật gần nhất lúc{" "}
              {new Date(kpiCapNhatLuc).toLocaleString("vi-VN")}
            </p>
          )}

          <Card padding="p-0" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-medium text-slate-500">
                    <th className="px-4 py-3">Nhân viên</th>
                    <th className="px-4 py-3">Loại HĐ</th>
                    <th className="px-4 py-3 text-right">Lương cứng/tháng</th>
                    <th className="px-4 py-3 text-right">Buổi công</th>
                    <th className="px-4 py-3 text-right">Lương thực nhận</th>
                    <th className="px-4 py-3 text-right">Tỷ lệ đạt KPI</th>
                    <th className="px-4 py-3">Điều kiện thưởng</th>
                    <th className="px-4 py-3 text-right">Thưởng KPI</th>
                    <th className="px-4 py-3 text-right">DS Kê đơn - PM (TH/KH)</th>
                    <th className="px-4 py-3 text-right">Thưởng DS Kê đơn - PM</th>
                    <th className="px-4 py-3 text-right">Tổng thu nhập</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsHienThi.map((r) => {
                    const apDungDoanhSo = r.vi_tri === "NVKD" || r.vi_tri === "SS";
                    const ds = apDungDoanhSo ? dsByMa.get(r.ma_nhan_vien) : undefined;
                    const tongThuNhapDay =
                      (r.tong_thu_nhap_uoc_tinh ?? 0) + (ds?.thuong_doanh_so_cuoi_cung ?? 0);
                    return (
                    <tr
                      key={r.ma_nhan_vien}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {ghepTenMa(r.ten_nhan_vien, r.ma_nhan_vien)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {VI_TRI_LABEL[r.vi_tri ?? ""] ?? r.vi_tri}
                          {r.ten_ss ? ` · ${r.ten_ss}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {r.loai_hop_dong === "Thử việc" ? (
                          <Badge tone="warning">Thử việc</Badge>
                        ) : (
                          <span className="text-xs text-slate-500">Chính thức</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.luong_cung != null ? (
                          formatVnd(r.luong_cung)
                        ) : (
                          <span className="text-xs text-slate-400">Chưa nhập</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {r.buoi_cong_thuc_te ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                        {r.luong_cung != null ? formatVnd(r.luong_thuc_nhan ?? 0) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {formatPercent(r.ty_le_dat_kpi)}
                      </td>
                      <td className="px-4 py-3">
                        {r.vi_tri !== "NVKD" && r.vi_tri !== "SS" ? (
                          <span className="text-xs text-slate-400">Không áp dụng</span>
                        ) : r.ty_le_dat_kpi == null ? (
                          <Badge tone="neutral">Chưa có dữ liệu KPI</Badge>
                        ) : r.dat_dieu_kien_thuong ? (
                          <Badge tone="success">Đủ điều kiện</Badge>
                        ) : (
                          <div>
                            <Badge tone="danger">Chưa đủ điều kiện</Badge>
                            {r.co_chi_tieu_duoi_50 && (
                              <p className="mt-1 text-[11px] text-red-500">Có chỉ tiêu &lt;50%</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {r.muc_thuong_kpi != null ? formatVnd(r.muc_thuong_kpi) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {!apDungDoanhSo ? (
                          <span className="text-xs text-slate-400">Không áp dụng</span>
                        ) : !ds || ds.ke_hoach == null || ds.thuc_hien == null ? (
                          <span className="text-xs text-slate-400">
                            {ds?.ly_do_thieu ?? "Chưa có dữ liệu"}
                          </span>
                        ) : (
                          <>
                            {formatVnd(ds.thuc_hien)} / {formatVnd(ds.ke_hoach)}
                            <p className="text-[11px] text-slate-400">{formatPercent(ds.ti_trong)}</p>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {!apDungDoanhSo ? (
                          <span className="text-xs text-slate-400">Không áp dụng</span>
                        ) : !ds || ds.thieu_du_lieu ? (
                          <div>
                            <Badge tone="neutral">Thiếu dữ liệu</Badge>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {ds?.ly_do_thieu ?? "Chưa có dữ liệu"}
                            </p>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium">
                              {formatVnd(ds.thuong_doanh_so_cuoi_cung ?? 0)}
                            </span>
                            {r.vi_tri === "SS" && (
                              <p className="text-[11px] text-slate-400">
                                M1: {formatVnd(ds.m1_ss ?? 0)} · M2: {formatVnd(ds.m2_ss ?? 0)}
                                {ds.ti_le_nhom_dat_kpi != null &&
                                  ` (nhóm đạt ${formatPercent(ds.ti_le_nhom_dat_kpi)})`}
                              </p>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                        {r.luong_cung != null ? (
                          <>
                            {formatVnd(tongThuNhapDay)}
                            {apDungDoanhSo && (!ds || ds.thieu_du_lieu) && (
                              <p className="text-[11px] font-normal text-amber-600">
                                *chưa gồm thưởng DS (thiếu dữ liệu)
                              </p>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <SectionHeading
            title=""
            description="Lương cứng / Loại hợp đồng lấy từ Google Sheet “Danh sách nhân viên - Quản lý” (đồng bộ qua workflow n8n) - sửa trực tiếp trong Sheet, không sửa trên trang này. Điều kiện xét thưởng KPIs: tỷ lệ đạt ≥ 85% và không có chỉ tiêu nào đạt dưới 50%. Nhân viên/SS thử việc vẫn được xét thưởng nếu đạt điều kiện trên. Thưởng doanh số Kê đơn - Phòng mạch tính theo Bảng 2 trong chính sách (khung doanh số kế hoạch × tỷ lệ đạt), SS chia M1 (70%, cá nhân) + M2 (30%, theo tỷ lệ nhân viên trong nhóm đạt Thưởng KPIs tháng, tính từ NVKD thâm niên ≥ 4 tháng). Dòng nào thiếu ngày bắt đầu, thiếu kế hoạch doanh số tháng này, hoặc kế hoạch dưới mức khung tối thiểu trong Bảng 2 sẽ hiển thị “Thiếu dữ liệu” thay vì tính bằng 0 - vui lòng bổ sung dữ liệu gốc (Ngày bắt đầu trong Danh sách nhân viên, Chi tiêu KPIs) để hệ thống tự tính lại."
          />
        </>
      )}
    </div>
  );
}
