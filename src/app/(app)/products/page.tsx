import { createClient } from "@/lib/supabase/server";
import ProductSelector from "@/components/product-selector";
import SsFilter from "@/components/ss-filter";
import NvFilter from "@/components/nv-filter";
import {
  formatVnd,
  fetchAllRows,
  isExcludedSaleRow,
  normalizeTinh,
  normalizeUnit,
  formatQty,
  mergeSaleRowsByMonth,
} from "@/lib/sales-channel";
import { ghepTenMa } from "@/lib/display";
import { Card, PageHeader, SectionHeading, EmptyState, StatCard, Badge } from "@/components/ui";
import { IconWallet, IconUsers, IconAlert, IconCheck } from "@/components/icons";

// Trang tong hop chi so theo TUNG san pham (khac voi trang Doanh so, tong hop
// theo NV/kenh).
//
// Cua so du lieu: CO DINH tu thang 1/2025 den nay (khong con la 12 thang cuon
// theo ngay hien tai nua) - theo yeu cau ASM. Rieng bieu do san luong theo
// thang can them 1 nam du lieu truoc do (tu 1/2024) chi de tinh "cung ky nam
// truoc", khong anh huong den cac chi so/danh sach khac tren trang.
//
// Dinh nghia (da chot voi ASM):
// - "Khach song": co >=2 don trong 4 thang gan nhat (luon cuon theo ngay hien
//   tai, khong lien quan moc 1/2025).
// - "Khach bi bo quen": co phat sinh tu 1/2025 den nay nhung KHONG dat tieu
//   chi "song" o tren (tung mua, gio thua/ngung lap don).
// - "Xu huong tang/giam": so sanh TONG SAN LUONG 3 thang gan nhat DA DONG SO
//   (thang -1, -2, -3, khong tinh thang hien tai vi con dang chay/chua day du
//   du lieu trong thang) voi TONG san luong 3 thang lien truoc do (thang -4,
//   -5, -6). Dung cua so 3 thang (khong phai 1 thang don le) de tranh tinh
//   trang 1 khach chi le mua theo dot (2-3 thang/lan) bi bao "giam sut" oan
//   chi vi dung thang doi chieu ho khong phat sinh don. Nguong +-20% de bot
//   nhieu cac dao dong nho.
//
// Hien thi chinh theo SAN LUONG (so_luong) thay vi doanh thu - de ASM de doi
// chieu voi ton kho/muc tieu ban hang theo don vi thuc te (hop/lo/vi...),
// khong bi anh huong boi bien dong gia ban giua cac don. Doanh thu van giu
// lam thong tin phu (hint) o vai cho.
type SaleRow = {
  ma_khach: string | null;
  ten_khach: string | null;
  tinh: string | null;
  ngay: string | null;
  doanh_thu: number | null;
  so_luong: number | null;
  don_vi_tinh: string | null;
  nhom_khach_hang: string | null;
  trang_thai?: string | null;
  ma_nhan_vien: string | null;
  ten_nhan_vien: string | null;
};

type ProductRow = { ten_san_pham_chuan_hoa: string | null; tong_doanh_thu: number | null };

type EmployeeRow = { ma_nhan_vien: string; ten_nhan_vien: string | null; ss: string | null };

type CustomerAgg = {
  ma_khach: string;
  ten_khach: string;
  tinh: string;
  ma_nhan_vien: string | null;
  ten_nhan_vien: string | null;
  revenueKy: number;
  soLuongKy: number;
  ordersIn4mo: number;
  ngayMuaGanNhat: string;
  monthlyQuantity: Map<string, number>;
};

// Moc co dinh - khong tu dong lui theo nam nhu truoc, chi doi khi ASM yeu cau.
const WINDOW_START_YEAR = 2025;
const WINDOW_START_MONTH0 = 0; // Thang 1 (index 0-based)

const GROWTH_THRESHOLD = 20; // %
const TOP_N = 10;
const CHART_HEIGHT = 160; // px

function normCode(code: string | null | undefined) {
  return (code ?? "").replace(/\D/g, "").replace(/^0+/, "") || code || "";
}

function addMonths(y: number, m0: number, delta: number) {
  const d = new Date(y, m0 + delta, 1);
  return { y: d.getFullYear(), m0: d.getMonth() };
}

function isoDate(y: number, m0: number, day = 1) {
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthKeyOf(y: number, m0: number) {
  return `${y}-${String(m0 + 1).padStart(2, "0")}`;
}

function monthLabelOf(y: number, m0: number) {
  return `T${m0 + 1}/${String(y).slice(2)}`;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ sp?: string; ss?: string; nv?: string }>;
}) {
  const sp = await searchParams;
  const selectedSs = sp.ss;
  const selectedNv = sp.nv;

  const supabase = await createClient();

  const now = new Date();
  const y = now.getFullYear();
  const m0 = now.getMonth();

  const windowStart = isoDate(WINDOW_START_YEAR, WINDOW_START_MONTH0, 1); // vd "2025-01-01"
  // Lui them 12 thang truoc moc chinh, chi de bieu do co du lieu doi chieu
  // "cung ky nam truoc" cho ca nhung thang dau tien cua cua so chinh.
  const compareAnchor = addMonths(WINDOW_START_YEAR, WINDOW_START_MONTH0, -12);
  const chartFetchStart = isoDate(compareAnchor.y, compareAnchor.m0, 1); // vd "2024-01-01"

  const start4 = addMonths(y, m0, -3);
  const cutoff4 = isoDate(start4.y, start4.m0, 1);
  // Xu huong: chi so sanh cac thang DA DONG SO, khong dung thang hien tai
  // (dang chay, du lieu chua day du nen luc nao cung thap/bang 0 dau thang).
  const recentKeys = [1, 2, 3].map((i) => {
    const d = addMonths(y, m0, -i);
    return monthKeyOf(d.y, d.m0);
  });
  const baselineKeys = [4, 5, 6].map((i) => {
    const d = addMonths(y, m0, -i);
    return monthKeyOf(d.y, d.m0);
  });

  // Danh sach san pham cho o chon - lay tu view tong hop theo thang, gop lai
  // theo ten va sap xep theo tong doanh thu (toan bo lich su) de goi y san
  // pham lon nhat len dau danh sach.
  const [prodRes, empRes] = await Promise.all([
    fetchAllRows<ProductRow>((from, to) =>
      supabase.from("v_product_sales_summary").select("ten_san_pham_chuan_hoa,tong_doanh_thu").range(from, to),
    ),
    supabase.from("Danh sach nhan vien").select("ma_nhan_vien,ten_nhan_vien,ss").neq("vi_tri", "ASM"),
  ]);

  const revenueByProduct = new Map<string, number>();
  for (const r of prodRes.data ?? []) {
    if (!r.ten_san_pham_chuan_hoa) continue;
    revenueByProduct.set(
      r.ten_san_pham_chuan_hoa,
      (revenueByProduct.get(r.ten_san_pham_chuan_hoa) ?? 0) + (r.tong_doanh_thu ?? 0),
    );
  }
  const products = Array.from(revenueByProduct.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const selectedProduct = sp.sp && products.includes(sp.sp) ? sp.sp : products[0];

  const ssByCode = new Map<string, string | null>();
  const nameByCode = new Map<string, string | null>();
  for (const e of (empRes.data ?? []) as EmployeeRow[]) {
    const code = normCode(e.ma_nhan_vien);
    ssByCode.set(code, e.ss);
    nameByCode.set(code, e.ten_nhan_vien);
  }
  // "Danh sach nhan vien" chi chua nhan su thuoc nhom ASM dang dang nhap (cac
  // ASM khac khong xuat hien o day) - dung chinh danh sach nay lam pham vi
  // mac dinh cua trang, vi bang sale la bang dung chung toan cong ty nen se
  // co ca ma NV cua cac ASM/nhom khac lan trong do.
  const teamCodes = new Set(ssByCode.keys());
  const ssList = Array.from(new Set(Array.from(ssByCode.values()).filter((v): v is string => !!v))).sort((a, b) =>
    a.localeCompare(b),
  );
  const employeeOptions = Array.from(nameByCode.entries())
    .filter(([code]) => !selectedSs || ssByCode.get(code) === selectedSs)
    .map(([code, name]) => ({ code, name: name ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!selectedProduct) {
    return (
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Sản phẩm" description="Chưa có dữ liệu sản phẩm nào." />
        {prodRes.error ? (
          <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            Lỗi tải danh sách sản phẩm: {prodRes.error.message}
          </p>
        ) : (
          <Card>
            <EmptyState>Không tìm thấy sản phẩm nào trong dữ liệu bán hàng.</EmptyState>
          </Card>
        )}
      </div>
    );
  }

  const cols =
    "ma_khach,ten_khach,tinh,ngay,doanh_thu,so_luong,don_vi_tinh,nhom_khach_hang,ma_nhan_vien,ten_nhan_vien";
  const [tongRes, hienTaiRes] = await Promise.all([
    fetchAllRows<SaleRow>((from, to) =>
      supabase
        .from("Du lieu sale tong")
        .select(cols)
        .eq("ten_san_pham_chuan_hoa", selectedProduct)
        .gte("ngay", chartFetchStart)
        .range(from, to),
    ),
    fetchAllRows<SaleRow>((from, to) =>
      supabase
        .from("Du lieu sale thang hien tai")
        .select(`${cols},trang_thai`)
        .eq("ten_san_pham_chuan_hoa", selectedProduct)
        .gte("ngay", chartFetchStart)
        .range(from, to),
    ),
  ]);

  const error = prodRes.error ?? empRes.error ?? tongRes.error ?? hienTaiRes.error;

  // "allRows" = toan bo du lieu da fetch (tu chartFetchStart, vd 1/2024) -
  // chi dung de tinh bieu do "cung ky". Cac chi so/danh sach khac tren trang
  // chi dung "rows" (da loc lai tu windowStart, vd 1/2025) dung nhu ASM yeu cau.
  let allRows = mergeSaleRowsByMonth(tongRes.data ?? [], hienTaiRes.data ?? [])
    .filter((r) => !isExcludedSaleRow(r))
    .filter((r) => teamCodes.has(normCode(r.ma_nhan_vien)));
  if (selectedSs) {
    allRows = allRows.filter((r) => ssByCode.get(normCode(r.ma_nhan_vien)) === selectedSs);
  }
  if (selectedNv) {
    allRows = allRows.filter((r) => normCode(r.ma_nhan_vien) === selectedNv);
  }
  const rows = allRows.filter((r) => (r.ngay ?? "") >= windowStart);

  // Tong san luong theo thang (khong tach khach hang) tren toan bo du lieu da
  // fetch - lam nguon cho bieu do va so sanh cung ky.
  const monthlyTotalsAll = new Map<string, number>();
  for (const r of allRows) {
    if (!r.ngay) continue;
    const key = r.ngay.slice(0, 7);
    monthlyTotalsAll.set(key, (monthlyTotalsAll.get(key) ?? 0) + (r.so_luong ?? 0));
  }

  const customers = new Map<string, CustomerAgg>();
  const donViCount = new Map<string, number>();
  for (const r of rows) {
    if (!r.ma_khach || !r.ngay) continue;
    const cur = customers.get(r.ma_khach) ?? {
      ma_khach: r.ma_khach,
      ten_khach: r.ten_khach || r.ma_khach,
      tinh: normalizeTinh(r.tinh),
      ma_nhan_vien: r.ma_nhan_vien,
      ten_nhan_vien: r.ten_nhan_vien,
      revenueKy: 0,
      soLuongKy: 0,
      ordersIn4mo: 0,
      ngayMuaGanNhat: r.ngay,
      monthlyQuantity: new Map<string, number>(),
    };
    cur.revenueKy += r.doanh_thu ?? 0;
    cur.soLuongKy += r.so_luong ?? 0;
    if (r.ngay >= cutoff4) cur.ordersIn4mo += 1;
    if (r.ngay > cur.ngayMuaGanNhat) {
      cur.ngayMuaGanNhat = r.ngay;
      // Cap nhat theo dong ban gan nhat de hien thi dung ten/tinh/NV hien hanh.
      cur.ten_khach = r.ten_khach || cur.ten_khach;
      cur.tinh = r.tinh ? normalizeTinh(r.tinh) : cur.tinh;
      cur.ma_nhan_vien = r.ma_nhan_vien;
      cur.ten_nhan_vien = r.ten_nhan_vien;
    }
    const key = r.ngay.slice(0, 7);
    cur.monthlyQuantity.set(key, (cur.monthlyQuantity.get(key) ?? 0) + (r.so_luong ?? 0));
    customers.set(r.ma_khach, cur);

    const unit = normalizeUnit(r.don_vi_tinh);
    if (unit) donViCount.set(unit, (donViCount.get(unit) ?? 0) + 1);
  }

  // Don vi tinh hien thi cho san pham dang chon - lay bien the pho bien nhat
  // (vi cung 1 don vi co the ghi khac nhau giua cac dong, vd "LO" vs "Lọ").
  const displayUnit = [...donViCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const allCustomers = Array.from(customers.values());
  const soKhachTrongKy = allCustomers.length;
  const tongDoanhThuKy = allCustomers.reduce((s, c) => s + c.revenueKy, 0);
  const tongSoLuongKy = allCustomers.reduce((s, c) => s + c.soLuongKy, 0);

  const khachSong = allCustomers.filter((c) => c.ordersIn4mo >= 2);
  const khachBoQuen = allCustomers
    .filter((c) => c.ordersIn4mo < 2)
    .sort((a, b) => b.ngayMuaGanNhat.localeCompare(a.ngayMuaGanNhat) || b.soLuongKy - a.soLuongKy);

  const topKhach = [...allCustomers].sort((a, b) => b.soLuongKy - a.soLuongKy).slice(0, TOP_N);

  const soLuongByTinh = new Map<string, number>();
  for (const c of allCustomers) {
    soLuongByTinh.set(c.tinh, (soLuongByTinh.get(c.tinh) ?? 0) + c.soLuongKy);
  }
  const tinhSorted = Array.from(soLuongByTinh.entries()).sort((a, b) => b[1] - a[1]);
  const topTinh = tinhSorted.slice(0, 8);

  type TrendItem = { customer: CustomerAgg; recentSum: number; baselineSum: number; pct: number };
  const trendCandidates: TrendItem[] = [];
  for (const c of allCustomers) {
    const baselineSum = baselineKeys.reduce((s, k) => s + (c.monthlyQuantity.get(k) ?? 0), 0);
    if (baselineSum <= 0) continue; // khong co nen so sanh (khach moi/it lich su) - bo qua thay vi bao giam oan
    const recentSum = recentKeys.reduce((s, k) => s + (c.monthlyQuantity.get(k) ?? 0), 0);
    const pct = ((recentSum - baselineSum) / baselineSum) * 100;
    trendCandidates.push({ customer: c, recentSum, baselineSum, pct });
  }
  const tangTruong = trendCandidates
    .filter((t) => t.pct >= GROWTH_THRESHOLD)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, TOP_N);
  const giam = trendCandidates
    .filter((t) => t.pct <= -GROWTH_THRESHOLD)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, TOP_N);

  const maxKhach = Math.max(1, ...topKhach.map((c) => c.soLuongKy));
  const maxTinh = Math.max(1, ...topTinh.map(([, v]) => v));

  // Bieu do san luong theo thang, tu T1/2025 den thang hien tai, kem cot doi
  // chieu "cung ky nam truoc" cho tung thang.
  const chartMonths: { key: string; label: string; value: number; compareValue: number }[] = [];
  {
    let cy = WINDOW_START_YEAR;
    let cm0 = WINDOW_START_MONTH0;
    while (cy < y || (cy === y && cm0 <= m0)) {
      const key = monthKeyOf(cy, cm0);
      const compare = addMonths(cy, cm0, -12);
      const compareKey = monthKeyOf(compare.y, compare.m0);
      chartMonths.push({
        key,
        label: monthLabelOf(cy, cm0),
        value: monthlyTotalsAll.get(key) ?? 0,
        compareValue: monthlyTotalsAll.get(compareKey) ?? 0,
      });
      const next = addMonths(cy, cm0, 1);
      cy = next.y;
      cm0 = next.m0;
    }
  }

  // Cung ky noi bat: thang gan nhat DA DONG SO (thang hien tai bo qua vi chua
  // day du) so voi cung thang nam truoc.
  const lastClosed = addMonths(y, m0, -1);
  const lastClosedKey = monthKeyOf(lastClosed.y, lastClosed.m0);
  const lastClosedCompare = addMonths(lastClosed.y, lastClosed.m0, -12);
  const lastClosedCompareKey = monthKeyOf(lastClosedCompare.y, lastClosedCompare.m0);
  const lastClosedValue = monthlyTotalsAll.get(lastClosedKey) ?? 0;
  const lastClosedCompareValue = monthlyTotalsAll.get(lastClosedCompareKey) ?? 0;
  const yoyPct =
    lastClosedCompareValue > 0 ? ((lastClosedValue - lastClosedCompareValue) / lastClosedCompareValue) * 100 : null;

  const MAX_BO_QUEN = 100;
  const windowLabel = `T${WINDOW_START_MONTH0 + 1}/${WINDOW_START_YEAR}`;

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <PageHeader
        title="Sản phẩm"
        description={`${selectedProduct} · Từ ${windowLabel} đến nay · Nhóm ASM Ngô Hồng Quân${
          selectedSs ? ` · Nhóm ${selectedSs}` : ""
        }${selectedNv ? ` · NV ${ghepTenMa(nameByCode.get(selectedNv), selectedNv)}` : ""}`}
        actions={
          <>
            <ProductSelector products={products} selected={selectedProduct} />
            {ssList.length > 0 && <SsFilter ssList={ssList} />}
            {employeeOptions.length > 0 && <NvFilter employees={employeeOptions} />}
          </>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Lỗi tải dữ liệu: {error.message}</p>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Tổng sản lượng (từ ${windowLabel})`}
          value={formatQty(tongSoLuongKy, displayUnit)}
          icon={<IconWallet className="h-5 w-5" />}
          tone="brand"
          hint={`≈ ${formatVnd(tongDoanhThuKy)} doanh thu`}
        />
        <StatCard
          label={`Khách phát sinh đơn (từ ${windowLabel})`}
          value={soKhachTrongKy.toLocaleString("vi-VN")}
          icon={<IconUsers className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="Khách sống (≥2 đơn / 4 tháng)"
          value={khachSong.length.toLocaleString("vi-VN")}
          icon={<IconCheck className="h-5 w-5" />}
          tone="success"
          hint={soKhachTrongKy ? `${((khachSong.length / soKhachTrongKy) * 100).toFixed(0)}% khách trong kỳ` : undefined}
        />
        <StatCard
          label="Khách bị bỏ quên"
          value={khachBoQuen.length.toLocaleString("vi-VN")}
          icon={<IconAlert className="h-5 w-5" />}
          tone="warning"
          hint={soKhachTrongKy ? `${((khachBoQuen.length / soKhachTrongKy) * 100).toFixed(0)}% khách trong kỳ` : undefined}
        />
      </div>

      <div className="mb-6">
        <Card>
          <SectionHeading
            title="Sản lượng theo tháng"
            description={
              yoyPct != null
                ? `${monthLabelOf(lastClosed.y, lastClosed.m0)}: ${formatQty(lastClosedValue, displayUnit)} · ${
                    yoyPct >= 0 ? "▲" : "▼"
                  } ${Math.abs(yoyPct).toFixed(0)}% so với cùng kỳ ${lastClosedCompare.y}`
                : `${monthLabelOf(lastClosed.y, lastClosed.m0)}: ${formatQty(lastClosedValue, displayUnit)} · chưa đủ dữ liệu cùng kỳ năm trước`
            }
          />
          <MonthlyChart data={chartMonths} unit={displayUnit} />
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading title="Khách hàng sản lượng cao nhất" count={topKhach.length} />
          <BarList
            items={topKhach.map((c) => [ghepTenMa(c.ten_khach, c.ma_khach), c.soLuongKy] as [string, number])}
            max={maxKhach}
            format={(n) => formatQty(n, displayUnit)}
          />
        </Card>
        <Card>
          <SectionHeading title="Tỉnh sản lượng cao nhất" count={topTinh.length} />
          <BarList items={topTinh} max={maxTinh} format={(n) => formatQty(n, displayUnit)} />
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            title="Khách hàng tăng trưởng"
            description="Tổng 3 tháng gần nhất (đã đóng sổ) so với 3 tháng liền trước"
            count={tangTruong.length}
          />
          <TrendList items={tangTruong} tone="success" unit={displayUnit} />
        </Card>
        <Card>
          <SectionHeading
            title="Khách hàng giảm sút"
            description="Tổng 3 tháng gần nhất (đã đóng sổ) so với 3 tháng liền trước"
            count={giam.length}
          />
          <TrendList items={giam} tone="danger" unit={displayUnit} />
        </Card>
      </div>

      <Card padding="p-0">
        <div className="p-5 pb-0">
          <SectionHeading
            title="Khách hàng bị bỏ quên, không lặp đơn"
            description={`Có mua từ ${windowLabel} đến nay nhưng không đạt ≥2 đơn / 4 tháng gần nhất${
              khachBoQuen.length > MAX_BO_QUEN ? ` · hiển thị ${MAX_BO_QUEN} đầu tiên` : ""
            }`}
            count={khachBoQuen.length}
          />
        </div>
        {khachBoQuen.length === 0 ? (
          <div className="p-5">
            <EmptyState>Không có khách hàng nào bị bỏ quên với sản phẩm này trong kỳ.</EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto p-5 pt-3">
            <table className="data-table w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Khách hàng</th>
                  <th className="py-2 pr-3 font-medium">Tỉnh</th>
                  <th className="py-2 pr-3 font-medium">NV phụ trách gần nhất</th>
                  <th className="py-2 pr-3 font-medium">Mua gần nhất</th>
                  <th className="py-2 pr-3 font-medium">Số đơn / 4 tháng</th>
                  <th className="py-2 font-medium">Sản lượng (từ {windowLabel})</th>
                </tr>
              </thead>
              <tbody>
                {khachBoQuen.slice(0, MAX_BO_QUEN).map((c) => (
                  <tr key={c.ma_khach} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-slate-900">{ghepTenMa(c.ten_khach, c.ma_khach)}</td>
                    <td className="py-2.5 pr-3 text-slate-700">{c.tinh}</td>
                    <td className="py-2.5 pr-3 text-slate-700">
                      {c.ma_nhan_vien ? ghepTenMa(c.ten_nhan_vien, c.ma_nhan_vien) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700">{c.ngayMuaGanNhat}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-slate-700">{c.ordersIn4mo}</td>
                    <td className="py-2.5 tabular-nums text-slate-700">{formatQty(c.soLuongKy, displayUnit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function BarList({
  items,
  max,
  format,
}: {
  items: [string, number][];
  max: number;
  format: (n: number) => string;
}) {
  if (items.length === 0) {
    return <EmptyState>Không có dữ liệu trong kỳ này.</EmptyState>;
  }
  return (
    <ul className="space-y-3">
      {items.map(([name, value], i) => (
        <li key={name} className="flex items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-slate-700">{name}</span>
              <span className="ml-2 shrink-0 font-semibold tabular-nums text-slate-900">{format(value)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-blue-700 to-blue-500"
                style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TrendList({
  items,
  tone,
  unit,
}: {
  items: { customer: CustomerAgg; recentSum: number; baselineSum: number; pct: number }[];
  tone: "success" | "danger";
  unit: string;
}) {
  if (items.length === 0) {
    return <EmptyState>Không có khách hàng nào ở mức này trong kỳ.</EmptyState>;
  }
  return (
    <ul className="space-y-2.5">
      {items.map(({ customer, recentSum, baselineSum, pct }) => (
        <li key={customer.ma_khach} className="flex items-center justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{ghepTenMa(customer.ten_khach, customer.ma_khach)}</p>
            <p className="text-xs text-slate-400">
              {formatQty(recentSum, unit)} (3 tháng gần nhất) · {formatQty(baselineSum, unit)} (3 tháng trước)
            </p>
          </div>
          <Badge tone={tone}>
            {tone === "success" ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function MonthlyChart({
  data,
  unit,
}: {
  data: { key: string; label: string; value: number; compareValue: number }[];
  unit: string;
}) {
  if (data.length === 0) {
    return <EmptyState>Không có dữ liệu để vẽ biểu đồ.</EmptyState>;
  }
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.compareValue)));
  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-blue-800 to-blue-500" /> Sản lượng
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> Cùng kỳ năm trước
        </span>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex items-end gap-3" style={{ minWidth: data.length * 52 }}>
          {data.map((d) => (
            <div key={d.key} className="flex w-11 shrink-0 flex-col items-center gap-1.5">
              <div className="flex h-8 flex-col items-center justify-end gap-0 text-center">
                <span className="whitespace-nowrap text-[9px] font-semibold leading-tight text-blue-800">
                  {d.value.toLocaleString("vi-VN")}
                </span>
                <span className="whitespace-nowrap text-[8px] leading-tight text-slate-400">
                  {d.compareValue.toLocaleString("vi-VN")}
                </span>
              </div>
              <div className="flex items-end gap-0.5" style={{ height: CHART_HEIGHT }}>
                <div
                  className="w-3.5 rounded-t bg-slate-200"
                  style={{ height: Math.max(2, Math.round((d.compareValue / max) * CHART_HEIGHT)) }}
                  title={`Cùng kỳ năm trước: ${formatQty(d.compareValue, unit)}`}
                />
                <div
                  className="w-3.5 rounded-t bg-gradient-to-t from-blue-800 to-blue-500"
                  style={{ height: Math.max(2, Math.round((d.value / max) * CHART_HEIGHT)) }}
                  title={`${d.label}: ${formatQty(d.value, unit)}`}
                />
              </div>
              <span className="whitespace-nowrap text-[10px] text-slate-400">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">* Tháng gần nhất có thể chưa đầy đủ dữ liệu (đang chạy).</p>
    </div>
  );
}
