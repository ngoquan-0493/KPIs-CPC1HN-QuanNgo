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

// ===========================================================================
// HO SO MOI THAU - hang doi TBMT tu phat hien qua email hang ngay (khac
// nguon voi thau_hop_dong/thau_chi_tiet o tren, day la du lieu "truoc khi
// trung thau": module tu dong doc mail "Bao dau thau ngay ...", loc theo
// tinh phu trach, tu tra cuu muasamcong.mpi.gov.vn va doi chieu danh muc
// thuoc dau thau (thau_danh_muc_thuoc). Xem chi tiet kien truc o project doc
// "module-thau-tu-dong-canh-bao-23.09.md".
// ===========================================================================

// Tu 25/9: scheduled task tra cuu ghi ca chi tiet hoat chat (khong chi ten san
// pham) - lay theo dung cac cot co trong Bang pham vi cung cap/Phu luc cua Ho
// so moi thau, khi khong doc duoc thi fallback ve danh muc thuoc dau thau cua
// Quan. Van giu tuong thich nguoc voi du lieu cu (string, hoac object chi co
// ten_hien_thi/ten_chuan tu truoc 25/9).
type ThauSanPhamChiTiet = {
  ten_thuoc?: string;
  ten_hien_thi?: string;
  ten_chuan?: string;
  ten_hoat_chat?: string | null;
  nong_do_ham_luong?: string | null;
  duong_dung?: string | null;
  dang_bao_che?: string | null;
  don_vi_tinh?: string | null;
  so_luong?: string | number | null;
  gia_ke_hoach?: string | number | null;
  nhom_thuoc?: string | null;
};

type ThauQueueRow = {
  id: number;
  so_tbmt: string;
  ten_goi_thau: string | null;
  chu_dau_tu: string | null;
  dia_diem: string | null;
  thoi_diem_dong_thau: string | null;
  trang_thai: "cho_xu_ly" | "da_xu_ly" | "loi" | "khong_co_du_lieu" | string;
  san_pham_doi_chieu: (string | ThauSanPhamChiTiet)[] | null;
  ghi_chu: string | null;
  created_at: string;
};

const QUEUE_TRANG_THAI: Record<
  string,
  { label: string; tone: "success" | "warning" | "danger" | "neutral" }
> = {
  cho_xu_ly: { label: "Chưa check", tone: "warning" },
  da_xu_ly: { label: "Đã check", tone: "success" },
  loi: { label: "Lỗi tra cứu", tone: "danger" },
  khong_co_du_lieu: { label: "Không có dữ liệu", tone: "neutral" },
};

function tenSanPham(item: string | ThauSanPhamChiTiet) {
  if (typeof item === "string") return item;
  return item.ten_thuoc ?? item.ten_hien_thi ?? item.ten_chuan ?? "?";
}

// Cac cot chi tiet theo dung Bang pham vi cung cap/Phu luc trong Ho so moi
// thau: Ten hoat chat - Nong do/ham luong - Duong dung - Dang bao che - Don
// vi tinh - So luong - Gia ke hoach - Nhom thuoc. Bo qua truong nao rong (vd
// gia ke hoach thuong khong cong khai) thay vi hien "—" day ca hang.
function chiTietSanPham(item: string | ThauSanPhamChiTiet): { nhan: string; gia: string }[] {
  if (typeof item === "string") return [];
  const rows: { nhan: string; gia: string }[] = [];
  if (item.ten_hoat_chat) rows.push({ nhan: "Hoạt chất", gia: item.ten_hoat_chat });
  if (item.nong_do_ham_luong) rows.push({ nhan: "Nồng độ/hàm lượng", gia: item.nong_do_ham_luong });
  if (item.duong_dung) rows.push({ nhan: "Đường dùng", gia: item.duong_dung });
  if (item.dang_bao_che) rows.push({ nhan: "Dạng bào chế", gia: item.dang_bao_che });
  if (item.don_vi_tinh) rows.push({ nhan: "Đơn vị tính", gia: item.don_vi_tinh });
  if (item.so_luong !== null && item.so_luong !== undefined && item.so_luong !== "")
    rows.push({ nhan: "Số lượng", gia: String(item.so_luong) });
  if (item.gia_ke_hoach !== null && item.gia_ke_hoach !== undefined && item.gia_ke_hoach !== "")
    rows.push({ nhan: "Giá kế hoạch", gia: formatGia(item.gia_ke_hoach) });
  if (item.nhom_thuoc) rows.push({ nhan: "Nhóm thuốc", gia: item.nhom_thuoc });
  return rows;
}

function formatGia(v: string | number) {
  if (typeof v === "number") return v.toLocaleString("vi-VN") + " đ";
  return v;
}

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

  const [dashRes, nhanVienRes, hdRes, queueRes] = await Promise.all([
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
    // Hang doi Ho so moi thau (TBMT tu phat hien qua email) - bang rieng,
    // khong lien quan RPC get_thau_dashboard o tren.
    supabase
      .from("thau_email_queue")
      .select(
        "id,so_tbmt,ten_goi_thau,chu_dau_tu,dia_diem,thoi_diem_dong_thau,trang_thai,san_pham_doi_chieu,ghi_chu,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
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

  const queueRows = (queueRes.data as ThauQueueRow[] | null) ?? [];
  const queueError = queueRes.error;
  const soChuaCheck = queueRows.filter((q) => q.trang_thai === "cho_xu_ly").length;
  const soDaCheck = queueRows.filter((q) => q.trang_thai === "da_xu_ly").length;
  const soLoiCheck = queueRows.filter((q) => q.trang_thai === "loi").length;

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

      {queueError && (
        <Card className="mb-5 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">Lỗi tải hồ sơ mời thầu: {queueError.message}</p>
        </Card>
      )}

      <Card className="mb-6">
        <SectionHeading
          title="Hồ sơ mời thầu"
          description="Gói thầu tự phát hiện qua email hàng ngày, tự tra cứu muasamcong.mpi.gov.vn và đối chiếu danh mục thuốc đấu thầu"
          count={queueRows.length}
        />
        {queueRows.length === 0 ? (
          <EmptyState>Chưa có gói thầu nào được ghi nhận.</EmptyState>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge tone="warning">{soChuaCheck} chưa check</Badge>
              <Badge tone="success">{soDaCheck} đã check</Badge>
              {soLoiCheck > 0 && <Badge tone="danger">{soLoiCheck} lỗi tra cứu</Badge>}
            </div>
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                    <th className="px-2 py-2">Số TBMT</th>
                    <th className="px-2 py-2">Gói thầu</th>
                    <th className="px-2 py-2">Đóng thầu</th>
                    <th className="px-2 py-2">Trạng thái</th>
                    <th className="px-2 py-2 w-[380px]">Sản phẩm khớp</th>
                  </tr>
                </thead>
                <tbody>
                  {queueRows.map((q) => {
                    const tt = QUEUE_TRANG_THAI[q.trang_thai] ?? {
                      label: q.trang_thai,
                      tone: "neutral" as const,
                    };
                    const sanPham = Array.isArray(q.san_pham_doi_chieu) ? q.san_pham_doi_chieu : [];
                    return (
                      <tr key={q.id} className="border-b border-slate-100 last:border-0 align-top">
                        <td className="px-2 py-2 font-mono text-xs text-slate-600">{q.so_tbmt}</td>
                        <td className="px-2 py-2">
                          <p className="font-medium text-slate-800">{q.ten_goi_thau ?? "—"}</p>
                          <p className="text-xs text-slate-400">
                            {q.chu_dau_tu ?? "—"} · {q.dia_diem ?? "—"}
                          </p>
                        </td>
                        <td className="px-2 py-2 text-xs text-slate-600">
                          {q.thoi_diem_dong_thau ?? "—"}
                        </td>
                        <td className="px-2 py-2">
                          <Badge tone={tt.tone}>{tt.label}</Badge>
                          {q.trang_thai === "loi" && q.ghi_chu && (
                            <p className="mt-1 max-w-[220px] text-[11px] text-red-500">{q.ghi_chu}</p>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {sanPham.length === 0 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {sanPham.map((sp, i) => {
                                const chiTiet = chiTietSanPham(sp);
                                return (
                                  <div
                                    key={i}
                                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"
                                  >
                                    <Badge tone="brand">{tenSanPham(sp)}</Badge>
                                    {chiTiet.length > 0 && (
                                      <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                                        {chiTiet.map((c) => (
                                          <div key={c.nhan} className="contents">
                                            <dt className="text-slate-400">{c.nhan}</dt>
                                            <dd className="text-slate-700">{c.gia}</dd>
                                          </div>
                                        ))}
                                      </dl>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {queueRows.some(
              (q) => Array.isArray(q.san_pham_doi_chieu) && q.san_pham_doi_chieu.some((sp) => typeof sp !== "string" && chiTietSanPham(sp).length === 0),
            ) && (
              <p className="mt-2 text-[11px] text-slate-400">
                Một số sản phẩm khớp chưa có chi tiết hoạt chất/nồng độ/giá — do hồ sơ mời thầu không
                công khai (thường ở Chương V dạng file nén không đọc được) hoặc là kết quả từ trước
                25/9/2026, trước khi module trích xuất thêm chi tiết.
              </p>
            )}
          </>
        )}
      </Card>

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
