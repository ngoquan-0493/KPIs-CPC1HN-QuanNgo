import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/current-employee";
import { fetchAllRows } from "@/lib/sales-channel";
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
// ===========================================================================

type ThauRow = {
  hop_dong_id: number;
  so_hd: string;
  ma_khach: string;
  ten_khach: string | null;
  tinh: string | null;
  mien: string | null;
  loai_hd: string | null;
  ngay_het_hieu_luc: string | null;
  so_ngay_con_lai: number | null;
  trang_thai_hd: string;
  ma_nhan_vien_phu_trach: string | null;
  ten_nhan_vien: string | null;
  ten_ss: string | null;
  thuoc_nhom_asm: boolean | null;
  co_trong_khach_hang_master: boolean | null;
  ma_hang: string;
  ten_mat_hang: string | null;
  ten_chuan: string | null;
  nhom_sp: string | null;
  la_sptt: boolean | null;
  so_luong_ke_hoach: number | null;
  so_luong_thuc_hien: number | null;
  so_luong_con_lai: number | null;
  gia_tri_ke_hoach: number | null;
  gia_tri_thuc_hien: number | null;
  gia_tri_con_lai: number | null;
  ngay_bao_cao: string | null;
};

type EmployeeRow = { ma_nhan_vien: string; ten_nhan_vien: string | null; ss: string | null };

const COLS =
  "hop_dong_id,so_hd,ma_khach,ten_khach,tinh,mien,loai_hd,ngay_het_hieu_luc,so_ngay_con_lai,trang_thai_hd,ma_nhan_vien_phu_trach,ten_nhan_vien,ten_ss,thuoc_nhom_asm,co_trong_khach_hang_master,ma_hang,ten_mat_hang,ten_chuan,nhom_sp,la_sptt,so_luong_ke_hoach,so_luong_thuc_hien,so_luong_con_lai,gia_tri_ke_hoach,gia_tri_thuc_hien,gia_tri_con_lai,ngay_bao_cao";

const TOP_N = 15;

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

  const { data: rows, error } = await fetchAllRows<ThauRow>((from, to) => {
    let q = supabase.from("v_thau_chi_tiet").select(COLS);
    if (sp.mien) q = q.eq("mien", sp.mien);
    if (sp.tinh) q = q.eq("tinh", sp.tinh);
    if (sp.tt) q = q.eq("trang_thai_hd", sp.tt);
    if (sp.ss) q = q.eq("ten_ss", sp.ss);
    if (sp.nv) q = q.eq("ma_nhan_vien_phu_trach", sp.nv);
    if (sp.asm === "1") q = q.eq("thuoc_nhom_asm", true);
    if (sp.q) q = q.or(`ten_khach.ilike.%${sp.q}%,ma_khach.ilike.%${sp.q}%,so_hd.ilike.%${sp.q}%`);
    return q.range(from, to) as unknown as PromiseLike<{
      data: ThauRow[] | null;
      error: { message: string } | null;
    }>;
  });

  const { data: nhanVienRaw } = await supabase
    .from("Danh sach nhan vien")
    .select("ma_nhan_vien,ten_nhan_vien,ss")
    .eq("trang_thai", "Đang làm việc")
    .order("ten_nhan_vien");

  const nhanVienList = ((nhanVienRaw as EmployeeRow[] | null) ?? []).map((nv) => ({
    ma: nv.ma_nhan_vien,
    ten: nv.ten_nhan_vien ?? nv.ma_nhan_vien,
    ss: nv.ss,
  }));

  // Danh sach gia tri cho cac bo loc - lay 1 lan tu bang hop dong (nho, 1.209
  // dong) thay vi suy ra tu ket qua da loc (neu khong bo loc se tu thu hep dan
  // va khong quay lai duoc).
  const { data: hdRaw } = await supabase
    .from("thau_hop_dong")
    .select("tinh,mien")
    .range(0, 1999);
  const tinhList = Array.from(
    new Set(((hdRaw as { tinh: string | null }[] | null) ?? []).map((r) => r.tinh).filter(Boolean)),
  ).sort() as string[];
  const ssList = Array.from(new Set(nhanVienList.map((nv) => nv.ss).filter(Boolean))).sort() as string[];

  const data = rows ?? [];

  // ---- Tong hop cap hop dong ----
  type HopDong = {
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
    coTrongMaster: boolean;
    soMatHang: number;
    soChuaGiao: number;
    gtKeHoach: number;
    gtThucHien: number;
    gtConLai: number;
  };

  const hopDongMap = new Map<number, HopDong>();
  let gtKeHoach = 0;
  let gtThucHien = 0;
  let gtConLai = 0;
  let dongChuaGiao = 0;

  for (const r of data) {
    const kh = r.gia_tri_ke_hoach ?? 0;
    const th = r.gia_tri_thuc_hien ?? 0;
    const cl = r.gia_tri_con_lai ?? 0;
    gtKeHoach += kh;
    gtThucHien += th;
    gtConLai += cl;
    if ((r.so_luong_thuc_hien ?? 0) === 0) dongChuaGiao += 1;

    let hd = hopDongMap.get(r.hop_dong_id);
    if (!hd) {
      hd = {
        id: r.hop_dong_id,
        so_hd: r.so_hd,
        ma_khach: r.ma_khach,
        ten_khach: r.ten_khach ?? r.ma_khach,
        tinh: r.tinh ?? "—",
        ngay_het_hieu_luc: r.ngay_het_hieu_luc,
        so_ngay_con_lai: r.so_ngay_con_lai,
        trang_thai_hd: r.trang_thai_hd,
        ma_nhan_vien_phu_trach: r.ma_nhan_vien_phu_trach,
        ten_nhan_vien: r.ten_nhan_vien,
        coTrongMaster: !!r.co_trong_khach_hang_master,
        soMatHang: 0,
        soChuaGiao: 0,
        gtKeHoach: 0,
        gtThucHien: 0,
        gtConLai: 0,
      };
      hopDongMap.set(r.hop_dong_id, hd);
    }
    hd.soMatHang += 1;
    if ((r.so_luong_thuc_hien ?? 0) === 0) hd.soChuaGiao += 1;
    hd.gtKeHoach += kh;
    hd.gtThucHien += th;
    hd.gtConLai += cl;
  }

  const hopDongs = Array.from(hopDongMap.values());
  const soKhachHang = new Set(data.map((r) => r.ma_khach)).size;
  const soChuaGan = hopDongs.filter((h) => !h.ma_nhan_vien_phu_trach).length;
  const tyLeThucHien = gtKeHoach > 0 ? (gtThucHien / gtKeHoach) * 100 : 0;

  const sapHetHan = hopDongs
    .filter((h) => h.trang_thai_hd === "Sắp hết hạn" && h.gtConLai > 0)
    .sort((a, b) => (a.so_ngay_con_lai ?? 0) - (b.so_ngay_con_lai ?? 0));
  const gtSapHetHan = sapHetHan.reduce((s, h) => s + h.gtConLai, 0);

  const topHopDong = [...hopDongs].sort((a, b) => b.gtConLai - a.gtConLai).slice(0, 50);

  // ---- Top mat hang con lai nhieu nhat (gop theo ten chuan) ----
  const sanPhamMap = new Map<
    string,
    { ten: string; nhomSp: string; laSptt: boolean; slConLai: number; gtConLai: number; gtThucHien: number; soHd: Set<number> }
  >();
  for (const r of data) {
    const key = r.ten_chuan || r.ten_mat_hang || r.ma_hang;
    let p = sanPhamMap.get(key);
    if (!p) {
      p = {
        ten: key,
        nhomSp: r.nhom_sp ?? "—",
        laSptt: !!r.la_sptt,
        slConLai: 0,
        gtConLai: 0,
        gtThucHien: 0,
        soHd: new Set(),
      };
      sanPhamMap.set(key, p);
    }
    p.slConLai += r.so_luong_con_lai ?? 0;
    p.gtConLai += r.gia_tri_con_lai ?? 0;
    p.gtThucHien += r.gia_tri_thuc_hien ?? 0;
    p.soHd.add(r.hop_dong_id);
    if (r.la_sptt) p.laSptt = true;
  }
  const topSanPham = Array.from(sanPhamMap.values())
    .sort((a, b) => b.gtConLai - a.gtConLai)
    .slice(0, TOP_N);

  const ngayBaoCao = data[0]?.ngay_bao_cao ?? null;

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
          hint={`${hopDongs.length.toLocaleString("vi-VN")} hợp đồng · ${soKhachHang.toLocaleString("vi-VN")} khách`}
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
          hint={`${sapHetHan.length} hợp đồng còn dư hàng`}
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
          count={sapHetHan.length}
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
                {sapHetHan.slice(0, 20).map((h) => {
                  const pct = h.gtKeHoach > 0 ? (h.gtThucHien / h.gtKeHoach) * 100 : 0;
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
                        {formatTien(h.gtConLai)}
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
          count={hopDongs.length}
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
                  const pct = h.gtKeHoach > 0 ? (h.gtThucHien / h.gtKeHoach) * 100 : 0;
                  return (
                    <tr key={h.id} className="border-b border-slate-100 last:border-0 align-top">
                      <td className="px-2 py-2">
                        <p className="font-medium text-slate-800">{h.ten_khach}</p>
                        <p className="text-xs text-slate-400">
                          {h.ma_khach} · {h.tinh}
                          {!h.coTrongMaster && (
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
                        {formatTien(h.gtKeHoach)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        <span className="text-slate-700">{formatTien(h.gtThucHien)}</span>
                        <p className="text-[11px]">
                          <Badge tone={tonePhanTram(pct)}>{pct.toFixed(0)}%</Badge>
                        </p>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                        {formatTien(h.gtConLai)}
                      </td>
                      <td className="px-2 py-2 text-right text-xs text-slate-600">
                        {h.soMatHang}
                        {h.soChuaGiao > 0 && (
                          <span className="text-amber-600"> · {h.soChuaGiao} chưa giao</span>
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
          count={sanPhamMap.size}
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
                      {p.laSptt && (
                        <Badge tone="brand" className="ml-2">
                          SPTT
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-500">{p.nhomSp}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-600">
                      {p.soHd.size}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                      {formatSl(p.slConLai)}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {formatTien(p.gtConLai)}
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
