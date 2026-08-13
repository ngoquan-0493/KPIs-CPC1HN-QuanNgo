import { createClient } from "@/lib/supabase/server";
import { fetchAllRows, isExcludedSaleRow } from "@/lib/sales-channel";
import { ghepTenMa } from "@/lib/display";
import { Badge, Card, EmptyState, SectionHeading, StatCard } from "@/components/ui";
import { IconAlert, IconClock, IconUsers } from "@/components/icons";
import TheoDoiToggle from "@/components/theo-doi-toggle";
import { weekBoundsTheoDoi, type MucDoCanhBao } from "@/lib/week-bounds-theo-doi";

// Chi 2 nhom KH duoc ap chi tieu lap don theo skill pharma-lap-don-target -
// Thau/KM/Online/Miniapp la kenh tu nhien, khong tinh "can theo doi".
const KENH_AP_DUNG = new Set(["Bv kê đơn", "Phòng mạch"]);

type LapDonRow = {
  ma_khach: string;
  ten_khach: string | null;
  ma_nhan_vien: string | null;
  ten_nhan_vien: string | null;
  ma_san_pham: string | null;
  ten_san_pham: string | null;
  muc_do_canh_bao: string | null;
  thang_danh_gia: string | null;
  don_gan_nhat: string | null;
};

type SaleRow = {
  ma_khach: string | null;
  ten_khach: string | null;
  ma_hang: string | null;
  ten_san_pham_chuan_hoa: string | null;
  ma_nhan_vien: string | null;
  ten_nhan_vien: string | null;
  nhom_khach_hang: string | null;
  doanh_thu: number | null;
  thang: number | null;
  nam: number | null;
  trang_thai?: string | null;
};

type PlanRow = {
  ma_khach: string;
  ma_san_pham: string | null;
  muc_do_canh_bao: string;
  trang_thai: string;
  giao_boi: string | null;
  ma_nhan_vien: string;
};

type CheckinRow = { ma_khach: string | null };

export type CanhBaoItem = {
  maKhach: string;
  tenKhach: string | null;
  maNhanVien: string;
  tenNhanVien: string | null;
  maSanPham: string;
  tenSanPham: string | null;
  mucDo: MucDoCanhBao;
  donGanNhat: string | null;
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

// "T7/2026" -> 202607 de so sanh/sap xep; 0 neu khong parse duoc.
function parseThangDanhGia(s: string | null): number {
  const m = (s ?? "").match(/T(\d+)\/(\d+)/);
  if (!m) return 0;
  return Number(m[2]) * 100 + Number(m[1]);
}

function thangLuiVe(nam: number, thang: number, soThangLui: number): { nam: number; thang: number } {
  let t = thang - soThangLui;
  let n = nam;
  while (t <= 0) {
    t += 12;
    n -= 1;
  }
  return { nam: n, thang: t };
}

function formatThangDanhGia(nam: number, thang: number): string {
  return `T${thang}/${nam}`;
}

function normCode(code: string | null | undefined) {
  return (code ?? "").replace(/\D/g, "").replace(/^0+/, "") || code || "";
}

// Tinh danh sach cap (khach - san pham) o muc "Sap den han": dung logic
// CASE 1 cua skill pharma-lap-don-target khi only_month = thang lien truoc
// (T-1) - hien tai skill dang BO QUA truong hop nay vi "qua gan, chua can chi
// tieu", nhung day chinh la tin hieu canh bao SOM ma nguoi dung yeu cau bo
// sung (truoc khi no thanh "Khan" vao thang sau).
async function tinhSapDenHan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  thangHienTai: { nam: number; thang: number },
  daCoTrongLapDon: Set<string>,
): Promise<CanhBaoItem[]> {
  // Cua so 4 thang T-4..T-1 tinh tu thang danh gia (giong skill).
  const cuaSo = [4, 3, 2, 1].map((soThangLui) => thangLuiVe(thangHienTai.nam, thangHienTai.thang, soThangLui));
  const cols =
    "ma_khach,ten_khach,ma_hang,ten_san_pham_chuan_hoa,ma_nhan_vien,ten_nhan_vien,nhom_khach_hang,doanh_thu,thang,nam,trang_thai";

  const orDieuKien = cuaSo.map((c) => `and(nam.eq.${c.nam},thang.eq.${c.thang})`).join(",");

  const [tongRes, hienTaiRes] = await Promise.all([
    fetchAllRows<SaleRow>((from, to) =>
      supabase.from("Du lieu sale tong").select(cols).or(orDieuKien).range(from, to),
    ),
    fetchAllRows<SaleRow>((from, to) =>
      supabase.from("Du lieu sale thang hien tai").select(cols).or(orDieuKien).range(from, to),
    ),
  ]);

  const rows = [...tongRes.data, ...hienTaiRes.data];
  const thangT1 = cuaSo[3]; // T-1: phan tu cuoi cung trong mang cuaSo

  type Key = string;
  const thangCoDonByKey = new Map<Key, Set<number>>();
  const infoByKey = new Map<
    Key,
    { maKhach: string; tenKhach: string | null; maSp: string; tenSp: string | null; maNv: string | null; tenNv: string | null }
  >();

  for (const r of rows) {
    if (!r.ma_khach || !r.ma_hang) continue;
    if (!KENH_AP_DUNG.has((r.nhom_khach_hang ?? "").trim())) continue;
    if ((r.doanh_thu ?? 0) <= 0) continue;
    if (isExcludedSaleRow(r)) continue;
    if (r.nam == null || r.thang == null) continue;

    const key = `${r.ma_khach}|${r.ma_hang}`;
    if (daCoTrongLapDon.has(key)) continue; // da co trong Khan/Uu tien/Mo coi roi

    const thangKey = r.nam * 100 + r.thang;
    if (!thangCoDonByKey.has(key)) thangCoDonByKey.set(key, new Set());
    thangCoDonByKey.get(key)!.add(thangKey);
    if (!infoByKey.has(key)) {
      infoByKey.set(key, {
        maKhach: r.ma_khach,
        tenKhach: r.ten_khach,
        maSp: r.ma_hang,
        tenSp: r.ten_san_pham_chuan_hoa,
        maNv: r.ma_nhan_vien,
        tenNv: r.ten_nhan_vien,
      });
    }
  }

  const thangT1Key = thangT1.nam * 100 + thangT1.thang;
  const ketQua: CanhBaoItem[] = [];
  for (const [key, thangSet] of thangCoDonByKey) {
    // Chi dung 1 thang duy nhat trong ca so 4 thang, va thang do dung la T-1.
    if (thangSet.size !== 1) continue;
    if (!thangSet.has(thangT1Key)) continue;
    const info = infoByKey.get(key);
    if (!info || !info.maNv) continue;
    ketQua.push({
      maKhach: info.maKhach,
      tenKhach: info.tenKhach,
      maNhanVien: info.maNv,
      tenNhanVien: info.tenNv,
      maSanPham: info.maSp,
      tenSanPham: info.tenSp,
      mucDo: "Sắp đến hạn",
      donGanNhat: formatThangDanhGia(thangT1.nam, thangT1.thang),
    });
  }
  return ketQua;
}

export default async function TheoDoiSection({
  selectedSs,
  selectedNv,
  ssByCode,
  employees,
  viTriHienTai,
  maNhanVienHienTai,
}: {
  selectedSs?: string;
  selectedNv?: string;
  ssByCode: Map<string, string | null>;
  employees: { code: string; name: string; ss: string | null }[];
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
  const supabase = await createClient();

  const { data: lapDonData, error: lapDonError } = await fetchAllRows<LapDonRow>((from, to) =>
    supabase
      .from("phan_loai_khach_hang_can_lap_don")
      .select("ma_khach,ten_khach,ma_nhan_vien,ten_nhan_vien,ma_san_pham,ten_san_pham,muc_do_canh_bao,thang_danh_gia,don_gan_nhat")
      .range(from, to),
  );

  if (lapDonError) {
    return (
      <Card>
        <p className="text-sm text-red-700">Lỗi tải dữ liệu cảnh báo: {lapDonError.message}</p>
      </Card>
    );
  }

  const thangDanhGiaMoiNhatSo = Math.max(0, ...lapDonData.map((r) => parseThangDanhGia(r.thang_danh_gia)));
  const thangDanhGiaMoiNhat = thangDanhGiaMoiNhatSo
    ? `T${thangDanhGiaMoiNhatSo % 100}/${Math.floor(thangDanhGiaMoiNhatSo / 100)}`
    : null;

  const lapDonMoiNhat = lapDonData.filter((r) => parseThangDanhGia(r.thang_danh_gia) === thangDanhGiaMoiNhatSo);

  const daCoTrongLapDon = new Set(lapDonMoiNhat.map((r) => `${r.ma_khach}|${r.ma_san_pham}`));

  let danhSach: CanhBaoItem[] = lapDonMoiNhat
    .filter((r) => r.ma_san_pham && r.ma_nhan_vien && (r.muc_do_canh_bao === "Khẩn" || r.muc_do_canh_bao === "Ưu tiên" || r.muc_do_canh_bao === "Mồ côi"))
    .map((r) => ({
      maKhach: r.ma_khach,
      tenKhach: r.ten_khach,
      maNhanVien: r.ma_nhan_vien as string,
      tenNhanVien: r.ten_nhan_vien,
      maSanPham: r.ma_san_pham as string,
      tenSanPham: r.ten_san_pham,
      mucDo: r.muc_do_canh_bao as MucDoCanhBao,
      donGanNhat: r.don_gan_nhat,
    }));

  if (thangDanhGiaMoiNhatSo) {
    const nam = Math.floor(thangDanhGiaMoiNhatSo / 100);
    const thang = thangDanhGiaMoiNhatSo % 100;
    const sapDenHan = await tinhSapDenHan(supabase, { nam, thang }, daCoTrongLapDon);
    danhSach = [...danhSach, ...sapDenHan];
  }

  // Loc theo bo loc SS/NV dang chon tren trang (dung chung voi danh sach chinh).
  if (selectedSs) {
    danhSach = danhSach.filter((r) => ssByCode.get(normCode(r.maNhanVien)) === selectedSs);
  }
  if (selectedNv) {
    danhSach = danhSach.filter((r) => normCode(r.maNhanVien) === selectedNv);
  }

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

  const maKhachList = Array.from(new Set(danhSach.map((r) => r.maKhach)));
  const { start, end } = weekBoundsTheoDoi();

  const [planRes, checkinRes] = await Promise.all([
    maKhachList.length > 0
      ? supabase
          .from("khach_hang_theo_doi_ke_hoach")
          .select("ma_khach,ma_san_pham,muc_do_canh_bao,trang_thai,giao_boi,ma_nhan_vien")
          .eq("tuan_bat_dau", start)
          .in("ma_khach", maKhachList)
      : Promise.resolve({ data: [] as PlanRow[] }),
    maKhachList.length > 0
      ? fetchAllRows<CheckinRow>((from, to) =>
          supabase
            .from("Du lieu cham cong thang hien tai")
            .select("ma_khach")
            .in("ma_khach", maKhachList)
            .gte("thoi_gian_checkin", `${start}T00:00:00`)
            .lte("thoi_gian_checkin", `${end}T23:59:59`)
            .range(from, to),
        )
      : Promise.resolve({ data: [] as CheckinRow[], error: null }),
  ]);

  const planByKey = new Map<string, PlanRow>();
  for (const p of (planRes.data ?? []) as PlanRow[]) {
    planByKey.set(`${p.ma_khach}|${p.ma_san_pham ?? ""}`, p);
  }
  const daViengTuanNay = new Set(
    ((checkinRes as { data: CheckinRow[] | null }).data ?? []).map((c) => c.ma_khach).filter((v): v is string => !!v),
  );

  // Muc "Da hoan thanh tuan nay" (da tick + da viengly tham) mac dinh an theo
  // yeu cau: chi giu hien nhung muc CHUA dua vao lich HOAC da dua vao nhung
  // chua duoc viengly tham.
  const canXuLy: CanhBaoItem[] = [];
  const daHoanThanh: CanhBaoItem[] = [];
  for (const item of danhSach) {
    const plan = planByKey.get(`${item.maKhach}|${item.maSanPham}`);
    const daTick = !!plan;
    const daVieng = daViengTuanNay.has(item.maKhach);
    if (daTick && daVieng) {
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
                const plan = planByKey.get(`${item.maKhach}|${item.maSanPham}`);
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
                const nvDaGiao = plan?.ma_nhan_vien ?? item.maNhanVien;
                const tenNvDaGiao =
                  normCode(nvDaGiao) === normCode(item.maNhanVien)
                    ? item.tenNhanVien
                    : (tenNvTheoMa.get(normCode(nvDaGiao)) ?? null);
                const dongNghiepCungSs = nvTheoSs.get(ssByCode.get(normCode(item.maNhanVien)) ?? "") ?? [];
                // Luon giu NV goc trong danh sach chon (du co the da nghi
                // viec nen khong con trong "Danh sach nhan vien" dang hoat
                // dong/nvTheoSs) - de SS/ASM van thay ro dang giao lai TU AI,
                // khong bi mat lua chon "giu nguyen nguoi cu" neu ho van con.
                const coNvGoc = dongNghiepCungSs.some((nv) => normCode(nv.code) === normCode(item.maNhanVien));
                const danhSachNvCungSs = coNvGoc
                  ? dongNghiepCungSs
                  : [
                      {
                        code: item.maNhanVien,
                        name: item.tenNhanVien
                          ? `${item.tenNhanVien} (có thể đã nghỉ việc)`
                          : item.maNhanVien,
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
                      daLenKeHoach={!!plan}
                      daViengTham={daViengTuanNay.has(item.maKhach)}
                      giaoBoi={plan?.giao_boi ?? null}
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
