"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  duyetDongKpi,
  duyetHangLoatChoNv,
  tuChoiDongKpi,
  xoaDongKpi,
  dieuChinhKeHoachDongKpi,
  datNguongNhomChoDuyet,
  datDiemKeHoachNhomChoDuyet,
  layTatCaKpiTheoThang,
  layTenKhachTheoMa,
  type ChiTieuKpiRow,
  type ChoDuyetGroup,
} from "@/app/(app)/kpi/build-actions";
import {
  layCauHinhChiTieu,
  TRANG_THAI_DUYET_LABEL,
  TRANG_THAI_DUYET_TONE,
} from "@/lib/kpi-chi-tieu";
import { ghepTenMa } from "@/lib/display";
import { Card, Badge, EmptyState, SectionHeading } from "@/components/ui";

const inputClass =
  "rounded-lg border border-slate-200 p-2 text-xs outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

function thangHomNay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function thangSauNay(soThang: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + soThang, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function isoToMonthInput(iso: string): string {
  return iso.slice(0, 7);
}
function monthInputToIso(v: string): string {
  return `${v}-01`;
}
function formatThang(iso: string): string {
  const [y, m] = iso.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

// Hien thi tieu de nhom theo dung yeu cau "Mã nhân viên - Tên nhân viên" (đảo
// thứ tự so với ghepTenMa() dùng ở các trang khác - "Tên (Mã)" - vì mục Phê
// duyệt cần ưu tiên quét nhanh theo mã NV).
function maTruocTen(ma: string, ten: string | null | undefined): string {
  const t = (ten ?? "").trim();
  if (!t || t === ma) return ma;
  return `${ma} - ${t}`;
}

// Nhom "doanh_so" (Doanh so ke don - phong mach / Doanh so thau) khong co
// khach hang/san pham rieng - chi_tiet_ke_hoach_san_pham la SO TIEN KE HOACH,
// nen phai hien o cot "Kế hoạch" (xem keHoachDong) thay vi o day, tranh vua
// lap lai vua khien cot Kế hoạch bi rong.
function moTaDong(row: ChiTieuKpiRow, tenKhach: string | null): string {
  const cauHinh = layCauHinhChiTieu(row.chi_tieu);
  if (cauHinh?.nhom === "doanh_so") return "—";
  const parts: string[] = [];
  if (row.ma_khach) parts.push(ghepTenMa(tenKhach, row.ma_khach));
  if (row.chi_tiet_ke_hoach_san_pham && row.chi_tiet_ke_hoach_san_pham !== cauHinh?.ghiChuMacDinh) {
    parts.push(row.chi_tiet_ke_hoach_san_pham);
  }
  return parts.join(" · ") || "—";
}

function keHoachDong(row: ChiTieuKpiRow): string {
  const cauHinh = layCauHinhChiTieu(row.chi_tieu);
  if (cauHinh?.nhom === "doanh_so") {
    const n = Number(row.chi_tiet_ke_hoach_san_pham);
    return Number.isFinite(n) ? `${n.toLocaleString("vi-VN")} đ` : (row.chi_tiet_ke_hoach_san_pham ?? "—");
  }
  const parts: string[] = [];
  if (row.so_luong_khach_hang_ke_hoach != null) parts.push(`${row.so_luong_khach_hang_ke_hoach} khách`);
  if (row.san_luong_ke_hoach_toi_thieu != null) parts.push(`SL tối thiểu ${row.san_luong_ke_hoach_toi_thieu}`);
  if (row.so_luong_toi_thieu_can_dat != null) parts.push(`ngưỡng nhóm ${row.so_luong_toi_thieu_can_dat}`);
  return parts.join(" · ") || "—";
}

function trangThaiBadge(trangThai: string) {
  return (
    <Badge tone={TRANG_THAI_DUYET_TONE[trangThai] ?? "neutral"}>
      {TRANG_THAI_DUYET_LABEL[trangThai] ?? trangThai}
    </Badge>
  );
}

type DieuChinhForm = {
  soLuongKhachHangKeHoach: string;
  sanLuongKeHoachToiThieu: string;
  soLuongToiThieuCanDat: string;
  soTienKeHoach: string;
  diemKpisKeHoach: string;
};

function rowToDieuChinhForm(row: ChiTieuKpiRow): DieuChinhForm {
  return {
    soLuongKhachHangKeHoach: row.so_luong_khach_hang_ke_hoach?.toString() ?? "",
    sanLuongKeHoachToiThieu: row.san_luong_ke_hoach_toi_thieu?.toString() ?? "",
    soLuongToiThieuCanDat: row.so_luong_toi_thieu_can_dat?.toString() ?? "",
    soTienKeHoach: row.chi_tiet_ke_hoach_san_pham ?? "",
    diemKpisKeHoach: row.diem_kpis_ke_hoach?.toString() ?? "",
  };
}

function DongKpi({
  row,
  tenKhach,
  onXongViec,
}: {
  row: ChiTieuKpiRow;
  tenKhach: string | null;
  onXongViec: () => void;
}) {
  const cauHinh = layCauHinhChiTieu(row.chi_tieu);
  const [tuChoiMode, setTuChoiMode] = useState(false);
  const [dieuChinhMode, setDieuChinhMode] = useState(false);
  const [lyDo, setLyDo] = useState("");
  const [form, setForm] = useState<DieuChinhForm>(() => rowToDieuChinhForm(row));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDuyet() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await duyetDongKpi(row.id);
        onXongViec();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function handleTuChoi() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await tuChoiDongKpi(row.id, lyDo);
        onXongViec();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function handleXoa() {
    if (!window.confirm("Xóa hẳn dòng KPI này? Không thể hoàn tác.")) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await xoaDongKpi(row.id);
        onXongViec();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function handleLuuDieuChinh() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await dieuChinhKeHoachDongKpi(row.id, {
          soLuongKhachHangKeHoach: cauHinh?.canSoLuongKhach
            ? form.soLuongKhachHangKeHoach
              ? Number(form.soLuongKhachHangKeHoach)
              : null
            : undefined,
          sanLuongKeHoachToiThieu: cauHinh?.canSanLuongToiThieu
            ? form.sanLuongKeHoachToiThieu
              ? Number(form.sanLuongKeHoachToiThieu)
              : null
            : undefined,
          soLuongToiThieuCanDat: cauHinh?.canNguongNhom
            ? form.soLuongToiThieuCanDat
              ? Number(form.soLuongToiThieuCanDat)
              : null
            : undefined,
          soTienKeHoach: cauHinh?.nhom === "doanh_so"
            ? form.soTienKeHoach
              ? Number(form.soTienKeHoach)
              : null
            : undefined,
          diemKpisKeHoach: Number(form.diemKpisKeHoach || 0),
        });
        setDieuChinhMode(false);
        onXongViec();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  if (dieuChinhMode) {
    return (
      <tr className="border-b border-slate-100 align-top last:border-0">
        <td colSpan={5} className="py-2">
          <p className="mb-1.5 text-xs font-medium text-slate-700">
            Điều chỉnh kế hoạch — {layCauHinhChiTieu(row.chi_tieu)?.nhan ?? row.chi_tieu}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {cauHinh?.canSoLuongKhach && (
              <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
                Số lượng khách hàng kế hoạch
                <input
                  type="number"
                  min={0}
                  value={form.soLuongKhachHangKeHoach}
                  disabled={isPending}
                  onChange={(e) => setForm({ ...form, soLuongKhachHangKeHoach: e.target.value })}
                  className={inputClass}
                />
              </label>
            )}
            {cauHinh?.canSanLuongToiThieu && (
              <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
                Số lượng tối thiểu (sản lượng kế hoạch tối thiểu)
                <input
                  type="number"
                  min={0}
                  value={form.sanLuongKeHoachToiThieu}
                  disabled={isPending}
                  onChange={(e) => setForm({ ...form, sanLuongKeHoachToiThieu: e.target.value })}
                  className={inputClass}
                />
              </label>
            )}
            {cauHinh?.canNguongNhom && (
              <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
                Ngưỡng nhóm (ngưỡng hoàn thành nhóm)
                <input
                  type="number"
                  min={0}
                  value={form.soLuongToiThieuCanDat}
                  disabled={isPending}
                  onChange={(e) => setForm({ ...form, soLuongToiThieuCanDat: e.target.value })}
                  className={inputClass}
                />
              </label>
            )}
            {cauHinh?.nhom === "doanh_so" && (
              <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
                Số tiền kế hoạch (đ)
                <input
                  type="number"
                  min={0}
                  value={form.soTienKeHoach}
                  disabled={isPending}
                  onChange={(e) => setForm({ ...form, soTienKeHoach: e.target.value })}
                  className={inputClass}
                />
              </label>
            )}
            <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
              Điểm KPI kế hoạch
              <input
                type="number"
                min={0}
                value={form.diemKpisKeHoach}
                disabled={isPending}
                onChange={(e) => setForm({ ...form, diemKpisKeHoach: e.target.value })}
                className={inputClass}
              />
            </label>
          </div>
          {errorMsg && <p className="mt-1.5 text-[11px] text-red-600">{errorMsg}</p>}
          <div className="mt-2 flex gap-2">
            <button
              disabled={isPending}
              onClick={handleLuuDieuChinh}
              className="rounded-lg bg-blue-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              Lưu điều chỉnh
            </button>
            <button
              disabled={isPending}
              onClick={() => {
                setDieuChinhMode(false);
                setForm(rowToDieuChinhForm(row));
                setErrorMsg(null);
              }}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Hủy
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 align-top last:border-0">
      <td className="py-2 pr-3 text-slate-800">
        <p className="font-medium">{layCauHinhChiTieu(row.chi_tieu)?.nhan ?? row.chi_tieu}</p>
        <p className="text-slate-500">{moTaDong(row, tenKhach)}</p>
        {row.ghi_chu_duyet && row.trang_thai_duyet === "tu_choi" && (
          <p className="mt-0.5 text-[11px] text-red-600">Lý do từ chối: {row.ghi_chu_duyet}</p>
        )}
      </td>
      <td className="py-2 pr-3 text-slate-700">{keHoachDong(row)}</td>
      <td className="py-2 pr-3 text-slate-700">{row.diem_kpis_ke_hoach ?? "—"}</td>
      <td className="py-2 pr-3">{trangThaiBadge(row.trang_thai_duyet)}</td>
      <td className="py-2">
        {!tuChoiMode ? (
          <div className="flex flex-wrap gap-2">
            {row.trang_thai_duyet === "cho_duyet" && (
              <>
                <button
                  disabled={isPending}
                  onClick={handleDuyet}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Duyệt
                </button>
                <button
                  disabled={isPending}
                  onClick={() => setTuChoiMode(true)}
                  className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Từ chối
                </button>
              </>
            )}
            <button
              disabled={isPending}
              onClick={() => setDieuChinhMode(true)}
              className="text-blue-700 hover:underline disabled:opacity-50"
            >
              Điều chỉnh
            </button>
            <button
              disabled={isPending}
              onClick={handleXoa}
              className="text-red-600 hover:underline disabled:opacity-50"
            >
              Xóa
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <textarea
              value={lyDo}
              onChange={(e) => setLyDo(e.target.value)}
              placeholder="Bắt buộc: lý do từ chối để NV sửa lại..."
              rows={2}
              className={`w-full ${inputClass}`}
            />
            <div className="flex gap-2">
              <button
                disabled={isPending || !lyDo.trim()}
                onClick={handleTuChoi}
                className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Xác nhận từ chối
              </button>
              <button
                disabled={isPending}
                onClick={() => {
                  setTuChoiMode(false);
                  setLyDo("");
                }}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
        {errorMsg && !dieuChinhMode && <p className="mt-1 text-[11px] text-red-600">{errorMsg}</p>}
      </td>
    </tr>
  );
}

export default function KpiDuyet({
  thangBanDau,
  groupsBanDau,
  tenNhanVienMap,
  tenKhachBanDau,
}: {
  thangBanDau: string;
  groupsBanDau: ChoDuyetGroup[];
  tenNhanVienMap: Record<string, string>;
  tenKhachBanDau: Record<string, string>;
}) {
  const [thang, setThang] = useState(thangBanDau);
  const [groups, setGroups] = useState<ChoDuyetGroup[]>(groupsBanDau);
  const [tenKhachMap, setTenKhachMap] = useState<Record<string, string>>(tenKhachBanDau);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Loc theo ten nhan vien - chi loc TRONG PHAM VI da duoc RLS scope san
  // (SS chi thay NV nhom minh, ASM thay ca team quan ly), khong phai loc
  // toan cong ty. "" = khong loc, hien tat ca.
  const [locNhanVien, setLocNhanVien] = useState("");

  const thangOptions = useMemo(
    () => [thangSauNay(-1), thangHomNay(), thangSauNay(1)].filter((v, i, a) => a.indexOf(v) === i),
    [],
  );

  async function taiLai(t: string) {
    setLoading(true);
    try {
      const data = await layTatCaKpiTheoThang(t);
      setGroups(data);
      const maList = data.flatMap((g) => g.rows.map((r) => r.ma_khach)).filter((v): v is string => !!v);
      if (maList.length > 0) setTenKhachMap(await layTenKhachTheoMa(maList));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (thang === thangBanDau) return;
    taiLai(thang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thang]);

  function handleDuyetTatCa(maNhanVien: string) {
    startTransition(async () => {
      await duyetHangLoatChoNv(maNhanVien, thang);
      await taiLai(thang);
    });
  }

  function handleDatNguong(maNhanVien: string, chiTieu: string, nguong: string) {
    const n = Number(nguong);
    if (!Number.isFinite(n) || n <= 0) return;
    startTransition(async () => {
      await datNguongNhomChoDuyet(maNhanVien, chiTieu, thang, n);
      await taiLai(thang);
    });
  }

  function handleDatDiemKeHoachNhom(maNhanVien: string, chiTieu: string, diem: string) {
    const n = Number(diem);
    if (!Number.isFinite(n) || n < 0) return;
    startTransition(async () => {
      await datDiemKeHoachNhomChoDuyet(maNhanVien, chiTieu, thang, n);
      await taiLai(thang);
    });
  }

  // Danh sach nhan vien de loc - lay tu chinh cac group dang co (da duoc
  // RLS scope san theo nguoi dang dang nhap: SS chi thay NV nhom minh, ASM
  // thay ca team), sap xep theo ten cho de quet. "" = khong loc (Tat ca).
  const nvOptions = useMemo(
    () =>
      groups
        .map((g) => ({ code: g.ma_nhan_vien, ten: tenNhanVienMap[g.ma_nhan_vien] ?? g.ma_nhan_vien }))
        .sort((a, b) => a.ten.localeCompare(b.ten, "vi")),
    [groups, tenNhanVienMap],
  );
  const groupsHienThi = useMemo(
    () => (locNhanVien ? groups.filter((g) => g.ma_nhan_vien === locNhanVien) : groups),
    [groups, locNhanVien],
  );

  const tongSoDong = groupsHienThi.reduce((s, g) => s + g.rows.length, 0);
  const tongChoDuyet = groupsHienThi.reduce(
    (s, g) => s + g.rows.filter((r) => r.trang_thai_duyet === "cho_duyet").length,
    0,
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Tháng</label>
          <select
            value={isoToMonthInput(thang)}
            onChange={(e) => setThang(monthInputToIso(e.target.value))}
            className={inputClass}
          >
            {thangOptions.map((t) => (
              <option key={t} value={isoToMonthInput(t)}>
                {formatThang(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Nhân viên</label>
          <select
            value={locNhanVien}
            onChange={(e) => setLocNhanVien(e.target.value)}
            className={inputClass}
          >
            <option value="">Tất cả nhân viên ({nvOptions.length})</option>
            {nvOptions.map((nv) => (
              <option key={nv.code} value={nv.code}>
                {nv.ten}
              </option>
            ))}
          </select>
        </div>
      </div>

      <SectionHeading
        title="Chỉ tiêu KPI theo nhân viên"
        description={`${formatThang(thang)} · ${groupsHienThi.length} nhân viên · ${tongSoDong} dòng (${tongChoDuyet} đang chờ duyệt)`}
      />

      {loading && <p className="text-sm text-slate-400">Đang tải…</p>}

      {!loading && groupsHienThi.length === 0 && (
        <EmptyState>
          {groups.length === 0
            ? `Chưa có chỉ tiêu KPI nào cho ${formatThang(thang).toLowerCase()}.`
            : "Không có chỉ tiêu KPI nào của nhân viên này trong tháng đã chọn."}
        </EmptyState>
      )}

      <div className="space-y-4">
        {groupsHienThi.map((g) => {
          const soDongChoDuyet = g.rows.filter((r) => r.trang_thai_duyet === "cho_duyet").length;
          return (
            <Card key={g.ma_nhan_vien} padding="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  {maTruocTen(g.ma_nhan_vien, tenNhanVienMap[g.ma_nhan_vien])}
                </h3>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{g.rows.length} dòng</Badge>
                  {soDongChoDuyet > 0 && (
                    <>
                      <Badge tone="warning">{soDongChoDuyet} chờ duyệt</Badge>
                      <button
                        disabled={isPending}
                        onClick={() => handleDuyetTatCa(g.ma_nhan_vien)}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Duyệt tất cả
                      </button>
                    </>
                  )}
                </div>
              </div>
              {Array.from(
                new Set(
                  g.rows
                    .filter((r) => layCauHinhChiTieu(r.chi_tieu)?.canNguongNhom)
                    .map((r) => r.chi_tieu),
                ),
              ).length > 0 && (
                <div className="mb-3 flex flex-wrap gap-3 rounded-xl bg-slate-50 p-2.5">
                  {Array.from(
                    new Set(
                      g.rows
                        .filter((r) => layCauHinhChiTieu(r.chi_tieu)?.canNguongNhom)
                        .map((r) => r.chi_tieu),
                    ),
                  ).map((chiTieu) => {
                    const rowsCungNhom = g.rows.filter((r) => r.chi_tieu === chiTieu);
                    const nguongHienTai = rowsCungNhom.find((r) => r.so_luong_toi_thieu_can_dat != null)
                      ?.so_luong_toi_thieu_can_dat;
                    const diemKeHoachNhomHienTai = rowsCungNhom.find((r) => r.diem_kpis_ke_hoach != null)
                      ?.diem_kpis_ke_hoach;
                    return (
                      <div key={chiTieu} className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        {(nguongHienTai == null || diemKeHoachNhomHienTai == null) && (
                          <Badge tone="warning">Chưa đặt đủ ngưỡng/điểm nhóm</Badge>
                        )}
                        <span className="font-medium text-slate-700">{layCauHinhChiTieu(chiTieu)?.nhan ?? chiTieu}</span>
                        <span className="flex items-center gap-1.5">
                          Ngưỡng hoàn thành nhóm:
                          <input
                            type="number"
                            min={0}
                            defaultValue={nguongHienTai ?? ""}
                            disabled={isPending}
                            onBlur={(e) => e.target.value && handleDatNguong(g.ma_nhan_vien, chiTieu, e.target.value)}
                            className={`w-16 ${inputClass}`}
                            title={`Số dòng tối thiểu trong nhóm "${chiTieu}" cần đạt để được 100% điểm cả nhóm`}
                          />
                          <span className="text-slate-400">/ {rowsCungNhom.length} dòng</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          Điểm kế hoạch nhóm:
                          <input
                            type="number"
                            min={0}
                            defaultValue={diemKeHoachNhomHienTai ?? ""}
                            disabled={isPending}
                            onBlur={(e) =>
                              e.target.value && handleDatDiemKeHoachNhom(g.ma_nhan_vien, chiTieu, e.target.value)
                            }
                            className={`w-20 ${inputClass}`}
                            title={`Tổng điểm KPI kế hoạch cho cả nhóm "${chiTieu}" tháng này`}
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="data-table w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-1.5 pr-3 font-medium">Chỉ tiêu</th>
                      <th className="py-1.5 pr-3 font-medium">Kế hoạch</th>
                      <th className="py-1.5 pr-3 font-medium">Điểm KH</th>
                      <th className="py-1.5 pr-3 font-medium">Trạng thái</th>
                      <th className="py-1.5 font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((row) => (
                      <DongKpi
                        key={row.id}
                        row={row}
                        tenKhach={row.ma_khach ? tenKhachMap[row.ma_khach] ?? null : null}
                        onXongViec={() => taiLai(thang)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
