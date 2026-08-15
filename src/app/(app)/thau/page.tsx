import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/current-employee";
import { Card, PageHeader, SectionHeading, EmptyState, StatCard, Badge } from "@/components/ui";
import { IconWallet, IconClock, IconAlert, IconCheck } from "@/components/icons";
import { ThauSelect, ThauSearch } from "@/components/thau-filters";
import ThauGanNv from "@/components/thau-gan-nv";

// ===========================================================================
// TRANG THAU - tien do thuc hien hop dong trung thau
//
// Nguon du lieu: bang thau_hop_dong + thau_chi_tiet, nap tu file Google Sheet
// "BC Thau" qua workflow n8n "Pharma Moi - 11 Import BC Thau" (chay tay moi
// khi ASM co file moi, khong theo lich co dinh).
//
// LUU Y QUAN TRONG VE SO LIEU (da doi chieu ngay 14/8/2026):
// - Cot "So luong thuc hien" LAY NGUYEN tu file thau, KHONG tinh lai tu bang
//   "Du lieu sale tong". Hai nguon nay lech nhau rat lon vi file thau ghi
//   TOAN BO hang giao theo hop dong (ke ca qua nha phan phoi), con sale tong
//   chi ghi phan sale duoc GAN CHO NHAN VIEN de tinh KPI. Vi du BVDK tinh Ha
//   Tinh: file bao Zencombi da giao 40.000, sale tong khong co dong nao.
//   => Khong duoc cong/tru cheo 2 nguon nay.
// - Ma khach trong file thau co them tien to "K" (KB00154) - da cat khi import
//   de join duoc voi khach_hang_master (B00154).
// - Cot "Dieu kien" trong file la so chenh lech/dieu chinh, dung dung nghia
//   "dieu kien hop dong": da kiem chung KH = TH + Con lai + Dieu kien tren
//   100% so dong.
//
// Toan bo cong don hop dong/san pham chay trong Postgres (RPC
// get_thau_dashboard) thay vi tai het ~vai nghin dong tho ve JS de gop -
// xem migration "add_thau_dashboard_rpc". Da doi chieu ket qua RPC voi truy
// van thu cong tren du lieu that (tong gt_ke_hoach/gt_thuc_hien/gt_con_lai,
// loc theo tinh, 1 dong hop dong, 1 dong san pham) - khop tuyet doi.
// ===========================================================================

type EmployeeRow = { ma_nhan_vien: string; ten_nhan_vien: string | null; ss: string | null };

type ThauStats = {
  gt_ke_hoach: number;
  gt_thuc_hien: number;
  gt_con_lai: number;
  dong_chua_giao: number;
  so_khach_hang: number;
  so_hop_dong: number;
  so_chua_gan: number;
  gt_sap_het_han: number;
  so_sap_het_han: number;
  so_san_pham: number;
  ngay_bao_cao: string | null;
};

type ThauHopDongRow = {
  id: number;
  so_hd: string;
  ma_khach: string;
  ten_khach: string;
  tinh: string;
  ngay_het_hieu_luc: string | null;
  so_ngay_con_lai: number | null;
  trang_thai_hd: string;
  ma_nhan_vien_phu_trach: string | null;
  ten_nhan_vien: string | null;
  co_trong_master: boolean;
  so_mat_hang: number;
  so_chua_giao: number;
  gt_ke_hoach: number;
  gt_thuc_hien: number;
  gt_con_lai: number;
};

type ThauSanPhamRow = {
  ten: string;
  nhom_sp: string;
  la_sptt: boolean;
  sl_con_lai: number;
  gt_con_lai: number;
  gt_thuc_hien: number;
  so_hd: number;
};

type ThauDashboard = {
  stats: ThauStats;
  sap_het_han: ThauHopDongRow[];
  top_hop_dong: ThauHopDongRow[];
  top_san_pham: ThauSanPhamRow[];
};

// Gia tri thau rat lon (hang tram ty) - hien theo ty/trieu cho de doc thay vi
// so day du nhu cac trang doanh so.
function formatTien(n: number) {
  if (!n) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " tỷ";
  if (abs >= 1e6) return (n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " tr";
  return Math.round(n).toLocaleString("vi-VN");
}

function formatSl(n: number) {
  return Math.round(n).toLocaleString("vi-VN");
}

function formatNgay(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function tonePhanTram(p: number) {
  if (p >= 70) return "success" as const;
  if (p >= 30) return "info" as const;
  if (p > 0) return "warning" as const;
  return "danger" as const;
}

export default async function ThauPage({
  searchParams,
}: {
  searchParams: Promise<{
    mien?: string;
    tinh?: string;
    tt?: string;
    ss?: string;
    nv?: string;
    asm?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const employee = await getCurrentEmployee();
  const viTri = employee?.["Vị trí"] ?? null;
  const coQuyenGan = viTri === "SS" || viTri === "ASM";

  const [dashRes, nhanVienRes, hdRes] = await Promise.all([
    supabase.rpc("get_thau_dashboard", {
      p_mien: sp.mien ?? null,
      p_tinh: sp.tinh ?? null,
      p_tt: sp.tt ?? null,
      p_ss: sp.ss ?? null,
      p_nv: sp.nv ?? null,
      p_asm: sp.asm === "1",
      p_q: sp.q || null,
    }),
    supabase
      .from("Danh sach nhan vien")
      .select("ma_nhan_vien,ten_nhan_vien,ss")
      .eq("trang_thai", "Đang làm việc")
      .order("ten_nhan_vien"),
    // Danh sach gia tri cho bo loc tinh - lay 1 lan tu bang hop dong (nho,
    // 1.209 dong) thay vi suy ra tu ket qua da loc (neu khong bo loc se tu
    // thu hep dan va khong quay lai duoc).
    supabase.from("thau_hop_dong").select("tinh,mien").range(0, 1999),
  ]);

  const error = dashRes.error;
  const dash = (dashRes.data ?? null) as ThauDashboard | null;

  const nhanVienList = ((nhanVienRes.data as EmployeeRow[] | null) ?? []).map((nv) => ({
    ma: nv.ma_nhan_vien,
    ten: nv.ten_nhan_vien ?? nv.ma_nhan_vien,
    ss: nv.ss,
  }));

  const tinhList = Array.from(
    new Set(((hdRes.data as { tinh: string | null }[] | null) ?? []).map((r) => r.tinh).filter(Boolean)),
  ).sort() as string[];
  const ssList = Array.from(new Set(nhanVienList.map((nv) => nv.ss).filter(Boolean))).sort() as string[];

  const stats = dash?.stats ?? null;
  const gtKeHoach = stats?.gt_ke_hoach ?? 0;
  const gtThucHien = stats?.gt_thuc_hien ?? 0;
  const gtConLai = stats?.gt_con_lai ?? 0;
  const dongChuaGiao = stats?.dong_chua_giao ?? 0;
  const soKhachHang = stats?.so_khach_hang ?? 0;
  const soHopDong = stats?.so_hop_dong ?? 0;
  const soChuaGan = stats?.so_chua_gan ?? 0;
  const gtSapHetHan = stats?.gt_sap_het_han ?? 0;
  const soSapHetHan = stats?.so_sap_het_han ?? 0;
  const soSanPham = stats?.so_san_pham ?? 0;
  const ngayBaoCao = stats?.ngay_bao_cao ?? null;
  const tyLeThucHien = gtKeHoach > 0 ? (gtThucHien / gtKeHoach) * 100 : 0;

  const sapHetHan = dash?.sap_het_han ?? [];
  const topHopDong = dash?.top_hop_dong ?? [];
  const topSanPham = dash?.top_san_pham ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Thầu"
        description={`Tiến độ thực hiện hợp đồng trúng thầu${
          ngayBaoCao ? ` · dữ liệu cập nhật ${formatNgay(ngayBaoCao)}` : ""
        }`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ThauSearch />
            <ThauSelect
              paramKey="tt"
              allLabel="Mọi trạng thái"
              options={[
                { value: "Còn hiệu lực", label: "Còn hiệu lực" },
                { value: "Sắp hết hạn", label: "Sắp hết hạn (≤90 ngày)" },
                { value: "Hết hiệu lực", label: "Hết hiệu lực" },
              ]}
            />
            <ThauSelect
              paramKey="mien"
              allLabel="Tất cả miền"
              options={[
                { value: "CNHN", label: "CN Hà Nội" },
                { value: "CNDN", label: "CN Đà Nẵng" },
                { value: "CNHCM", label: "CN HCM" },
              ]}
            />
            <ThauSelect
              paramKey="tinh"
              allLabel="Tất cả tỉnh"
              options={tinhList.map((t) => ({ value: t, label: t }))}
            />
            <ThauSelect
              paramKey="ss"
              allLabel="Tất cả nhóm SS"
              options={ssList.map((s) => ({ value: s, label: `Nhóm ${s}` }))}
            />
            <ThauSelect
              paramKey="asm"
              allLabel="Toàn quốc"
              options={[{ value: "1", label: "Chỉ khách nhóm ASM" }]}
            />
          </div>
        }
      />

      {error && (
        <Card className="mb-5 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">Lỗi tải dữ liệu thầu: {error.message}</p>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Giá trị trúng thầu"
          value={formatTien(gtKeHoach)}
          icon={<IconWallet className="h-5 w-5" />}
          tone="brand"
          hint={`${soHopDong.toLocaleString("vi-VN")} hợp đồng · ${soKhachHang.toLocaleString("vi-VN")} khách`}
        />
        <StatCard
          label="Đã thực hiện"
          value={formatTien(gtThucHien)}
          icon={<IconCheck className="h-5 w-5" />}
          tone="success"
          hint={`${tyLeThucHien.toFixed(1)}% giá trị trúng thầu`}
        />
        <StatCard
          label="Còn phải giao"
          value={formatTien(gtConLai)}
          icon={<IconClock className="h-5 w-5" />}
          tone="info"
          hint={`${dongChuaGiao.toLocaleString("vi-VN")} dòng chưa giao lần nào`}
        />
        <StatCard
          label="Sắp hết hạn ≤90 ngày"
          value={formatTien(gtSapHetHan)}
          icon={<IconAlert className="h-5 w-5" />}
          tone="warning"
          hint={`${soSapHetHan} hợp đồng còn dư hàng`}
        />
      </div>

      {soChuaGan > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/70">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">{soChuaGan.toLocaleString("vi-VN")} hợp đồng</span> chưa
            có người phụ trách. File báo cáo thầu không có cột này — {coQuyenGan ? "hãy" : "SS/ASM cần"}{" "}
            gán trực tiếp ở cột &quot;Phụ trách&quot; trong bảng bên dưới (gán 1 lần, các kỳ import
            sau không ghi đè).
          </p>
        </Card>
      )}

      <Card className="mb-6">
        <SectionHeading
          title="Hợp đồng sắp hết hạn còn dư hàng"
          description="Ưu tiên đẩy hàng trước khi hết hiệu lực"
          count={soSapHetHan}
        />
        {sapHetHan.length === 0 ? (
          <EmptyState>Không có hợp đồng nào sắp hết hạn trong 90 ngày tới.</EmptyState>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                  <th className="px-2 py-2">Khách hàng</th>
                  <th className="px-2 py-2">Số HĐ</th>
                  <th className="px-2 py-2 text-right">Hết hiệu lực</th>
                  <th className="px-2 py-2 text-right">Còn lại</th>
                  <th className="px-2 py-2 text-right">Giá trị dư</th>
                  <th className="px-2 py-2 text-right">Đã giao</th>
                </tr>
              </thead>
              <tbody>
                {sapHetHan.map((h) => {
                  const pct = h.gt_ke_hoach > 0 ? (h.gt_thuc_hien / h.gt_ke_hoach) * 100 : 0;
                  return (
                    <tr key={h.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-2 py-2">
                        <p className="font-medium text-slate-800">{h.ten_khach}</p>
                        <p className="text-xs text-slate-400">
                          {h.ma_khach} · {h.tinh}
                        </p>
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-600">{h.so_hd}</td>
                      <td className="px-2 py-2 text-right text-xs text-slate-600">
                        {formatNgay(h.ngay_het_hieu_luc)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Badge tone={(h.so_ngay_con_lai ?? 0) <= 30 ? "danger" : "warning"}>
                          {h.so_ngay_con_lai} ngày
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                        {formatTien(h.gt_con_lai)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Badge tone={tonePhanTram(pct)}>{pct.toFixed(0)}%</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <SectionHeading
          title="Hợp đồng theo giá trị còn lại"
          description="50 hợp đồng còn dư hàng nhiều nhất"
          count={soHopDong}
        />
        {topHopDong.length === 0 ? (
          <EmptyState>Không có hợp đồng nào khớp bộ lọc.</EmptyState>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                  <th className="px-2 py-2">Khách hàng</th>
                  <th className="px-2 py-2">Số HĐ</th>
                  <th className="px-2 py-2">Trạng thái</th>
                  <th className="px-2 py-2 text-right">Trúng thầu</th>
                  <th className="px-2 py-2 text-right">Đã giao</th>
                  <th className="px-2 py-2 text-right">Còn lại</th>
                  <th className="px-2 py-2 text-right">Mặt hàng</th>
                  <th className="px-2 py-2 w-52">Phụ trách</th>
                </tr>
              </thead>
              <tbody>
                {topHopDong.map((h) => {
                  const pct = h.gt_ke_hoach > 0 ? (h.gt_thuc_hien / h.gt_ke_hoach) * 100 : 0;
                  return (
                    <tr key={h.id} className="border-b border-slate-100 last:border-0 align-top">
                      <td className="px-2 py-2">
                        <p className="font-medium text-slate-800">{h.ten_khach}</p>
                        <p className="text-xs text-slate-400">
                          {h.ma_khach} · {h.tinh}
                          {!h.co_trong_master && (
                            <span className="ml-1 text-amber-600">· chưa có trong hệ thống KH</span>
                          )}
                        </p>
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-600">
                        {h.so_hd}
                        <p className="text-[11px] text-slate-400">
                          hết HL {formatNgay(h.ngay_het_hieu_luc)}
                        </p>
                      </td>
                      <td className="px-2 py-2">
                        <Badge
                          tone={
                            h.trang_thai_hd === "Hết hiệu lực"
                              ? "neutral"
                              : h.trang_thai_hd === "Sắp hết hạn"
                                ? "warning"
                                : "success"
                          }
                        >
                          {h.trang_thai_hd}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                        {formatTien(h.gt_ke_hoach)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        <span className="text-slate-700">{formatTien(h.gt_thuc_hien)}</span>
                        <p className="text-[11px]">
                          <Badge tone={tonePhanTram(pct)}>{pct.toFixed(0)}%</Badge>
                        </p>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                        {formatTien(h.gt_con_lai)}
                      </td>
                      <td className="px-2 py-2 text-right text-xs text-slate-600">
                        {h.so_mat_hang}
                        {h.so_chua_giao > 0 && (
                          <span className="text-amber-600"> · {h.so_chua_giao} chưa giao</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <ThauGanNv
                          hopDongId={h.id}
                          maNhanVien={h.ma_nhan_vien_phu_trach}
                          tenHienTai={h.ten_nhan_vien}
                          nhanVienList={nhanVienList}
                          coQuyen={coQuyenGan}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionHeading
          title="Mặt hàng còn dư nhiều nhất"
          description="Gộp theo tên sản phẩm chuẩn hoá"
          count={soSanPham}
        />
        {topSanPham.length === 0 ? (
          <EmptyState>Không có dữ liệu mặt hàng.</EmptyState>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                  <th className="px-2 py-2">Sản phẩm</th>
                  <th className="px-2 py-2">Nhóm</th>
                  <th className="px-2 py-2 text-right">Số HĐ</th>
                  <th className="px-2 py-2 text-right">SL còn lại</th>
                  <th className="px-2 py-2 text-right">Giá trị còn lại</th>
                </tr>
              </thead>
              <tbody>
                {topSanPham.map((p) => (
                  <tr key={p.ten} className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-2">
                      <span className="font-medium text-slate-800">{p.ten}</span>
                      {p.la_sptt && (
                        <Badge tone="brand" className="ml-2">
                          SPTT
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-500">{p.nhom_sp}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-600">{p.so_hd}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                      {formatSl(p.sl_con_lai)}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {formatTien(p.gt_con_lai)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-slate-400">
        Số liệu &quot;đã thực hiện&quot; lấy nguyên từ báo cáo thầu của công ty (toàn bộ hàng giao
        theo hợp đồng), không phải doanh số gán cho nhân viên ở trang Doanh số — hai con số này
        không trùng nhau.
      </p>
    </div>
  );
}
