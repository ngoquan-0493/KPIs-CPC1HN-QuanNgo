import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/current-employee";
import MonthSelector from "@/components/month-selector";
import SsFilter from "@/components/ss-filter";
import { formatVnd } from "@/lib/sales-channel";
import { ghepTenMa } from "@/lib/display";
import { Card, PageHeader, EmptyState, Badge, StatCard, SectionHeading } from "@/components/ui";
import { IconWallet, IconTarget, IconClock } from "@/components/icons";
import { LuongCungInput, LoaiHopDongSelect } from "@/components/luong-thuong-editable";

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
  const currentEmployee = await getCurrentEmployee();
  const viTriHienTai = currentEmployee?.["Vị trí"];
  const laAsm = viTriHienTai === "ASM";

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

  const { data, error } = await supabase.rpc("fn_luong_thuong_thang", {
    p_thang: selectedMonth,
  });

  const rows = ((data ?? []) as LuongThuongRow[]).slice();
  rows.sort((a, b) => {
    const va = VI_TRI_ORDER[a.vi_tri ?? ""] ?? 9;
    const vb = VI_TRI_ORDER[b.vi_tri ?? ""] ?? 9;
    if (va !== vb) return va - vb;
    return (a.ten_nhan_vien ?? "").localeCompare(b.ten_nhan_vien ?? "");
  });

  const ssList = Array.from(
    new Set(rows.map((r) => r.ten_ss).filter((v): v is string => !!v)),
  ).sort((a, b) => a.localeCompare(b));

  const selectedSs = sp.ss;
  const rowsHienThi = selectedSs ? rows.filter((r) => r.ten_ss === selectedSs) : rows;

  const tongLuongCung = rowsHienThi.reduce((s, r) => s + (r.luong_thuc_nhan ?? 0), 0);
  const tongThuongKpi = rowsHienThi.reduce((s, r) => s + (r.muc_thuong_kpi ?? 0), 0);
  const tongThuNhap = rowsHienThi.reduce((s, r) => s + (r.tong_thu_nhap_uoc_tinh ?? 0), 0);
  const soChuaNhapLuongCung = rowsHienThi.filter((r) => r.luong_cung == null).length;

  const kpiCapNhatLuc = rowsHienThi
    .map((r) => r.kpi_cap_nhat_luc)
    .filter((v): v is string => !!v)
    .sort()
    .at(-1);

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <PageHeader
        title="Lương - Thưởng"
        description="Lương cứng theo buổi công + thưởng KPIs. Thưởng doanh số sẽ bổ sung sau."
        actions={
          <>
            {months.length > 0 && selectedMonth && (
              <MonthSelector months={months} selected={selectedMonth} />
            )}
            {laAsm && ssList.length > 0 && <SsFilter ssList={ssList} />}
          </>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Lỗi tải dữ liệu: {error.message}
        </p>
      )}

      {!error && rowsHienThi.length === 0 && (
        <EmptyState>Không có dữ liệu lương - thưởng trong phạm vi của bạn cho tháng này.</EmptyState>
      )}

      {rowsHienThi.length > 0 && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              label="Tổng thu nhập ước tính"
              value={formatVnd(tongThuNhap)}
              icon={<IconWallet className="h-5 w-5" />}
              tone="info"
              hint="Chưa gồm thưởng doanh số"
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
                    <th className="px-4 py-3 text-right">Tổng thu nhập</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsHienThi.map((r) => (
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
                        {laAsm ? (
                          <LoaiHopDongSelect
                            maNhanVien={r.ma_nhan_vien}
                            giaTriBanDau={r.loai_hop_dong}
                          />
                        ) : r.loai_hop_dong === "Thử việc" ? (
                          <Badge tone="warning">Thử việc</Badge>
                        ) : (
                          <span className="text-xs text-slate-500">Chính thức</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {laAsm ? (
                          <LuongCungInput
                            maNhanVien={r.ma_nhan_vien}
                            giaTriBanDau={r.luong_cung}
                          />
                        ) : r.luong_cung != null ? (
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
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                        {r.luong_cung != null ? formatVnd(r.tong_thu_nhap_uoc_tinh ?? 0) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <SectionHeading
            title=""
            description="Điều kiện xét thưởng KPIs: tỷ lệ đạt ≥ 85% và không có chỉ tiêu nào đạt dưới 50%. Nhân viên/SS thử việc vẫn được xét thưởng nếu đạt điều kiện trên. Mức thưởng doanh số sẽ được bổ sung ở bản cập nhật sau."
          />
        </>
      )}
    </div>
  );
}
