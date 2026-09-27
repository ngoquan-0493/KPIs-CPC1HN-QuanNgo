import { createClient } from "@/lib/supabase/server";
import { ghepTenMa } from "@/lib/display";
import { Badge, Card, EmptyState, SectionHeading, StatCard } from "@/components/ui";
import { IconAlert, IconClock, IconUsers } from "@/components/icons";
import TheoDoiToggle from "@/components/theo-doi-toggle";
import { weekBoundsTheoDoi, type MucDoCanhBao } from "@/lib/week-bounds-theo-doi";

// 2026-09-27: Toan bo phan tim kiem + lam giau du lieu cua trang nay (Khan/Uu
// tien/Mo coi tu phan_loai_khach_hang_can_lap_don, "Sap den han" tu 2 bang
// doanh so, ke hoach tuan, da vieng tham tuan, SS phu trach) da CHUYEN VAO 1
// RPC duy nhat get_theo_doi_dashboard (Postgres) - truoc day la 3 vong
// round-trip TUAN TU (moi vong phai doi vong truoc xong moi biet goi gi tiep,
// vong giua con fetchAllRows het toan bo bang lich su "Du lieu sale tong" ~
// 86 nghin dong) khien tab "Khach hang can theo doi" bi cam giac "do lag" khi
// chuyen tab. Xem migration "add_theo_doi_dashboard_rpc".
//
// Nhan tien sua 1 loi da phat hien khi gop RPC: cau query cu chon ca cot
// trang_thai tren CA 2 bang doanh so, nhung "Du lieu sale tong" KHONG CO cot
// nay - PostgREST tra loi ngay (khong throw, code cu cung khong kiem tra
// error cua rieng vong nay) nen phan "Sap den han" tinh tu bang lich su gan
// nhu LUON RONG tu truoc den nay. RPC moi dung ham SQL is_excluded_sale_row()
// (da co san, dung chung voi get_customers_dashboard) nen khong con loi nay.

export type CanhBaoItem = {
  maKhach: string;
  tenKhach: string | null;
  maNhanVien: string;
  tenNhanVien: string | null;
  maSanPham: string;
  tenSanPham: string | null;
  mucDo: MucDoCanhBao;
  donGanNhat: string | null;
  // Gan them tu RPC - thay cho planByKey/daViengTuanNay/maSsPhuTrachByMaKhach
  // (cac Map duoc build tu 3 vong fetch rieng truoc day).
  planNv: string | null;
  planGiaoBoi: string | null;
  daLenKeHoach: boolean;
  daViengTham: boolean;
  maSsPhuTrach: string | null;
};

type RpcRow = {
  ma_khach: string;
  ten_khach: string | null;
  ma_nhan_vien: string;
  ten_nhan_vien: string | null;
  ma_san_pham: string;
  ten_san_pham: string | null;
  muc_do: MucDoCanhBao;
  don_gan_nhat: string | null;
  plan_nv: string | null;
  plan_giao_boi: string | null;
  da_len_ke_hoach: boolean;
  da_vieng_tham: boolean;
  ma_ss_phu_trach: string | null;
};

type TheoDoiDashboard = {
  thang_danh_gia_moi_nhat: string | null;
  items: RpcRow[];
};

const MUC_DO_ORDER: Record<MucDoCanhBao, number> = {
  "Khẩn": 4,
  "Ưu tiên": 3,
  "Sắp đến hạn": 2,
  "Mồ côi": 1,
};

const MUC_DO_TONE: Record<MucDoCanhBao, "danger" | "warning" | "info" | "neutral"> = {
  "Khẩn": "danger",
  "Ưu tiên": "warning",
  "Sắp đến hạn": "info",
  "Mồ côi": "neutral",
};

function normCode(code: string | null | undefined) {
  return (code ?? "").replace(/\D/g, "").replace(/^0+/, "") || code || "";
}

export default async function TheoDoiSection({
  selectedSs,
  selectedNv,
  ssByCode,
  employees,
  ssEmployees,
  viTriHienTai,
  maNhanVienHienTai,
}: {
  selectedSs?: string;
  selectedNv?: string;
  ssByCode: Map<string, string | null>;
  employees: { code: string; name: string; ss: string | null }[];
  ssEmployees: { code: string; name: string }[];
  viTriHienTai: string | null;
  maNhanVienHienTai: string | null;
}) {
  // Gom NV DANG HOAT DONG theo nhom SS - dung de SS/ASM giao lai 1 khach-san
  // pham qua han cho NV KHAC trong CUNG nhom khi NV goc phu trach da nghi
  // viec (khong con trong "Danh sach nhan vien" nen tu dong bien mat khoi
  // danh sach chon, xem TheoDoiToggle).
  const nvTheoSs = new Map<string, { code: string; name: string }[]>();
  const tenNvTheoMa = new Map<string, string>();
  for (const e of employees) {
    tenNvTheoMa.set(normCode(e.code), e.name);
    if (!e.ss) continue;
    if (!nvTheoSs.has(e.ss)) nvTheoSs.set(e.ss, []);
    nvTheoSs.get(e.ss)!.push({ code: e.code, name: e.name });
  }
  for (const list of nvTheoSs.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  const tenSsTheoMa = new Map<string, string>();
  for (const e of ssEmployees) tenSsTheoMa.set(normCode(e.code), e.name);

  const supabase = await createClient();
  const { start, end } = weekBoundsTheoDoi();

  const { data: dashData, error: dashError } = await supabase.rpc("get_theo_doi_dashboard", {
    p_ss: selectedSs ?? null,
    p_nv: selectedNv ?? null,
    p_tuan_bat_dau: start,
    p_tuan_ket_thuc: end,
  });

  if (dashError) {
    return (
      <Card>
        <p className="text-sm text-red-700">Lỗi tải dữ liệu cảnh báo: {dashError.message}</p>
      </Card>
    );
  }

  const dash = (dashData ?? null) as TheoDoiDashboard | null;
  const thangDanhGiaMoiNhat = dash?.thang_danh_gia_moi_nhat ?? null;

  const danhSach: CanhBaoItem[] = (dash?.items ?? []).map((r) => ({
    maKhach: r.ma_khach,
    tenKhach: r.ten_khach,
    maNhanVien: r.ma_nhan_vien,
    tenNhanVien: r.ten_nhan_vien,
    maSanPham: r.ma_san_pham,
    tenSanPham: r.ten_san_pham,
    mucDo: r.muc_do,
    donGanNhat: r.don_gan_nhat,
    planNv: r.plan_nv,
    planGiaoBoi: r.plan_giao_boi,
    daLenKeHoach: r.da_len_ke_hoach,
    daViengTham: r.da_vieng_tham,
    maSsPhuTrach: r.ma_ss_phu_trach,
  }));

  if (danhSach.length === 0) {
    return (
      <Card padding="p-0">
        <div className="p-5">
          <EmptyState>
            Không có khách hàng - sản phẩm nào cần theo dõi{thangDanhGiaMoiNhat ? ` cho ${thangDanhGiaMoiNhat}` : ""}.
          </EmptyState>
        </div>
      </Card>
    );
  }

  // Muc "Da hoan thanh tuan nay" (da tick + da viengly tham) mac dinh an theo
  // yeu cau: chi giu hien nhung muc CHUA dua vao lich HOAC da dua vao nhung
  // chua duoc viengly tham.
  const canXuLy: CanhBaoItem[] = [];
  const daHoanThanh: CanhBaoItem[] = [];
  for (const item of danhSach) {
    if (item.daLenKeHoach && item.daViengTham) {
      daHoanThanh.push(item);
    } else {
      canXuLy.push(item);
    }
  }

  canXuLy.sort((a, b) => {
    const diff = MUC_DO_ORDER[b.mucDo] - MUC_DO_ORDER[a.mucDo];
    if (diff !== 0) return diff;
    return (a.tenKhach ?? a.maKhach).localeCompare(b.tenKhach ?? b.maKhach);
  });

  // Gom theo khach hang - 1 khach co the co nhieu san pham can theo doi.
  const nhomTheoKhach = new Map<string, { tenKhach: string | null; maNhanVien: string; tenNhanVien: string | null; items: CanhBaoItem[] }>();
  for (const item of canXuLy) {
    const g = nhomTheoKhach.get(item.maKhach);
    if (g) g.items.push(item);
    else
      nhomTheoKhach.set(item.maKhach, {
        tenKhach: item.tenKhach,
        maNhanVien: item.maNhanVien,
        tenNhanVien: item.tenNhanVien,
        items: [item],
      });
  }
  const nhomList = Array.from(nhomTheoKhach.entries()).sort((a, b) => {
    const maxA = Math.max(...a[1].items.map((i) => MUC_DO_ORDER[i.mucDo]));
    const maxB = Math.max(...b[1].items.map((i) => MUC_DO_ORDER[i.mucDo]));
    return maxB - maxA;
  });

  const soKhan = canXuLy.filter((i) => i.mucDo === "Khẩn").length;
  const soUuTien = canXuLy.filter((i) => i.mucDo === "Ưu tiên").length;
  const soSapDenHan = canXuLy.filter((i) => i.mucDo === "Sắp đến hạn").length;

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Khẩn" value={soKhan.toLocaleString("vi-VN")} icon={<IconAlert className="h-5 w-5" />} tone="warning" />
        <StatCard label="Ưu tiên" value={soUuTien.toLocaleString("vi-VN")} icon={<IconClock className="h-5 w-5" />} tone="info" />
        <StatCard label="Sắp đến hạn" value={soSapDenHan.toLocaleString("vi-VN")} icon={<IconClock className="h-5 w-5" />} tone="brand" />
        <StatCard
          label="Khách hàng cần theo dõi"
          value={nhomList.length.toLocaleString("vi-VN")}
          icon={<IconUsers className="h-5 w-5" />}
          tone="success"
        />
      </div>

      <SectionHeading
        title="Khách hàng - sản phẩm cần theo dõi"
        description={`Theo tháng đánh giá ${thangDanhGiaMoiNhat ?? "—"} · gom theo khách hàng · tuần ${start} – ${end}`}
        count={nhomList.length}
      />

      <div className="space-y-3">
        {nhomList.map(([maKhach, g]) => (
          <Card key={maKhach} padding="p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-900">{ghepTenMa(g.tenKhach, maKhach)}</p>
              {viTriHienTai !== "NVKD" && (
                <span className="text-xs text-slate-400">NV: {ghepTenMa(g.tenNhanVien, g.maNhanVien)}</span>
              )}
            </div>
            <div className="space-y-2">
              {g.items.map((item) => {
                const laChinhMinh = normCode(maNhanVienHienTai) === normCode(item.maNhanVien);
                // NV xem dong cua chinh minh -> tu tick. SS/ASM xem dong cua NV
                // duoi quyen (da qua RLS scoped, chac chan la nguoi minh quan
                // ly) -> giao viec thay. Con lai (khong nen xay ra) -> chi xem.
                const chePDo: "tu_tick" | "giao_viec" | "chi_xem" =
                  viTriHienTai === "NVKD" && laChinhMinh
                    ? "tu_tick"
                    : viTriHienTai === "SS" || viTriHienTai === "ASM"
                      ? "giao_viec"
                      : "chi_xem";
                // NV DANG THUC SU duoc giao (co the KHAC voi item.maNhanVien
                // neu SS/ASM da giao lai cho 1 NV khac truoc do) - dung lam
                // gia tri chon san trong dropdown va de "Bo giao" xoa dung
                // dong hien co, khong con phu thuoc vao NV goc phu trach.
                const nvDaGiao = item.planNv ?? item.maNhanVien;
                const tenNvDaGiao =
                  normCode(nvDaGiao) === normCode(item.maNhanVien)
                    ? item.tenNhanVien
                    : (tenNvTheoMa.get(normCode(nvDaGiao)) ?? null);
                // Uu tien tra SS qua chinh NV goc (con trong "Danh sach nhan
                // vien"). Neu NV goc DA BI XOA HAN khoi bang do (nghi viec -
                // truong hop pho bien nhat gay ra canh bao qua han), ssByCode
                // se khong tim thay gi ca - fallback qua ma_ss_phu_trach cua
                // KHACH HANG (van con luu o khach_hang_master du NV da nghi),
                // roi quy doi ma SS -> ten SS de tra dung nhom trong nvTheoSs.
                const tenSsCuaNvGoc =
                  ssByCode.get(normCode(item.maNhanVien)) ??
                  tenSsTheoMa.get(normCode(item.maSsPhuTrach ?? "")) ??
                  "";
                const dongNghiepCungSs = nvTheoSs.get(tenSsCuaNvGoc) ?? [];
                // Luon giu NV goc trong danh sach chon (du co the da nghi
                // viec nen khong con trong "Danh sach nhan vien" dang hoat
                // dong/nvTheoSs) - de SS/ASM van thay ro dang giao lai TU AI,
                // khong bi mat lua chon "giu nguyen nguoi cu" neu ho van con.
                const coNvGoc = dongNghiepCungSs.some((nv) => normCode(nv.code) === normCode(item.maNhanVien));
                // Bug xac nhan 25/9/2026: truoc day NV goc da nghi viec van
                // duoc GIU NGUYEN nhu 1 lua chon binh thuong trong dropdown (va
                // con duoc CHON SAN mac dinh) - nhung visible_employee_codes()
                // (dung trong RLS cua khach_hang_theo_doi_ke_hoach) chi tra ve
                // nhung ma NV CON TON TAI trong "Danh sach nhan vien", nen giao
                // lai cho ho LUON BI RLS CHAN, va Next.js an het noi dung loi
                // that trong production khien nguoi dung chi thay loi do chung
                // chung ("Giao" hien do). Nay danh dau rieng entry nay bang
                // khaDung: false de dropdown VAN HIEN THI (biet dang giao lai TU
                // AI) nhung KHONG CHO CHON, va khong con duoc chon san mac dinh
                // (xem TheoDoiToggle).
                const danhSachNvCungSs = coNvGoc
                  ? dongNghiepCungSs
                  : [
                      {
                        code: item.maNhanVien,
                        name: item.tenNhanVien
                          ? `${item.tenNhanVien} (có thể đã nghỉ việc)`
                          : item.maNhanVien,
                        khaDung: false,
                      },
                      ...dongNghiepCungSs,
                    ];
                return (
                  <div
                    key={item.maSanPham}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone={MUC_DO_TONE[item.mucDo]}>{item.mucDo}</Badge>
                        <p className="truncate text-sm text-slate-800">{item.tenSanPham ?? item.maSanPham}</p>
                      </div>
                      {item.donGanNhat && (
                        <p className="mt-0.5 text-xs text-slate-400">Đơn gần nhất: {item.donGanNhat}</p>
                      )}
                    </div>
                    <TheoDoiToggle
                      maKhach={item.maKhach}
                      tenKhach={item.tenKhach}
                      maSanPham={item.maSanPham}
                      tenSanPham={item.tenSanPham}
                      mucDoCanhBao={item.mucDo}
                      thangDanhGia={thangDanhGiaMoiNhat}
                      maNhanVienMucTieu={item.maNhanVien}
                      nvDaGiao={nvDaGiao}
                      tenNvDaGiao={tenNvDaGiao}
                      danhSachNv={danhSachNvCungSs}
                      daLenKeHoach={item.daLenKeHoach}
                      daViengTham={item.daViengTham}
                      giaoBoi={item.planGiaoBoi}
                      chePDo={chePDo}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {daHoanThanh.length > 0 && (
        <p className="mt-4 text-xs text-slate-400">
          {daHoanThanh.length} mục đã lên kế hoạch và đã được ghé thăm trong tuần này — đã ẩn khỏi danh sách trên.
        </p>
      )}
    </div>
  );
}
