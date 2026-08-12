"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  taoDongKpiNhap,
  capNhatDongKpiNhap,
  xoaDongKpiNhap,
  guiDuyet,
  guiDuyetTatCa,
  datNguongNhom,
  timKiemKhachHang,
  timKiemSanPham,
  layDanhSachKpiTheoThang,
  layTenKhachTheoMa,
  type ChiTieuKpiRow,
  type KetQuaTimKhach,
} from "@/app/(app)/kpi/build-actions";
import {
  DANH_SACH_CHI_TIEU,
  layCauHinhChiTieu,
  TRANG_THAI_DUYET_LABEL,
  TRANG_THAI_DUYET_TONE,
} from "@/lib/kpi-chi-tieu";
import { ghepTenMa } from "@/lib/display";
import { Card, Badge, EmptyState, SectionHeading } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import KpiAutocomplete from "@/components/kpi-autocomplete";

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
  return iso.slice(0, 7); // "YYYY-MM-01" -> "YYYY-MM"
}

function monthInputToIso(v: string): string {
  return `${v}-01`;
}

function formatThang(iso: string): string {
  const [y, m] = iso.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

type FormState = {
  chiTieu: string;
  sanPham: string;
  maKhach: string;
  tenKhach: string;
  soLuongKhachHangKeHoach: string;
  sanLuongKeHoachToiThieu: string;
  soTienKeHoach: string;
  diemKpisKeHoach: string;
  ghiChu: string;
};

const FORM_RONG: FormState = {
  chiTieu: DANH_SACH_CHI_TIEU[0],
  sanPham: "",
  maKhach: "",
  tenKhach: "",
  soLuongKhachHangKeHoach: "",
  sanLuongKeHoachToiThieu: "",
  soTienKeHoach: "",
  diemKpisKeHoach: "",
  ghiChu: "",
};

function rowToForm(row: ChiTieuKpiRow, tenKhach: string | null): FormState {
  const cauHinh = layCauHinhChiTieu(row.chi_tieu);
  const isDoanhSo = cauHinh?.nhom === "doanh_so";
  return {
    chiTieu: row.chi_tieu,
    sanPham: !isDoanhSo ? row.chi_tiet_ke_hoach_san_pham ?? "" : "",
    maKhach: row.ma_khach ?? "",
    tenKhach: tenKhach ?? "",
    soLuongKhachHangKeHoach: row.so_luong_khach_hang_ke_hoach?.toString() ?? "",
    sanLuongKeHoachToiThieu: row.san_luong_ke_hoach_toi_thieu?.toString() ?? "",
    soTienKeHoach: isDoanhSo ? row.chi_tiet_ke_hoach_san_pham ?? "" : "",
    diemKpisKeHoach: row.diem_kpis_ke_hoach?.toString() ?? "",
    ghiChu: row.ghi_chu ?? "",
  };
}

function formToInput(maNhanVien: string, thangDanhGia: string, f: FormState) {
  return {
    maNhanVien,
    thangDanhGia,
    chiTieu: f.chiTieu,
    maKhach: f.maKhach || null,
    sanPham: f.sanPham || null,
    soTienKeHoach: f.soTienKeHoach ? Number(f.soTienKeHoach) : null,
    soLuongKhachHangKeHoach: f.soLuongKhachHangKeHoach ? Number(f.soLuongKhachHangKeHoach) : null,
    sanLuongKeHoachToiThieu: f.sanLuongKeHoachToiThieu ? Number(f.sanLuongKeHoachToiThieu) : null,
    diemKpisKeHoach: Number(f.diemKpisKeHoach || 0),
    ghiChu: f.ghiChu || null,
  };
}

// O nhap 1 dong chi tieu - dung chung cho ca "them moi" va "sua". Cac truong
// hien/an tuy nhom chi_tieu (xem lib/kpi-chi-tieu.ts).
function KpiRowForm({
  form,
  setForm,
  disabled,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  disabled?: boolean;
}) {
  const cauHinh = layCauHinhChiTieu(form.chiTieu);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <select
        value={form.chiTieu}
        disabled={disabled}
        onChange={(e) => setForm({ ...FORM_RONG, chiTieu: e.target.value })}
        className={inputClass}
      >
        {DANH_SACH_CHI_TIEU.map((ct) => (
          <option key={ct} value={ct}>
            {layCauHinhChiTieu(ct)?.nhan ?? ct}
          </option>
        ))}
      </select>

      {cauHinh?.canKhachHang && (
        <KpiAutocomplete<KetQuaTimKhach>
          value={form.maKhach || null}
          displayValue={form.maKhach ? ghepTenMa(form.tenKhach, form.maKhach) : null}
          onSelect={(kh) => setForm({ ...form, maKhach: kh.ma_khach, tenKhach: kh.ten_khach ?? "" })}
          onClear={() => setForm({ ...form, maKhach: "", tenKhach: "" })}
          search={timKiemKhachHang}
          getKey={(kh) => kh.ma_khach}
          getLabel={(kh) => ghepTenMa(kh.ten_khach, kh.ma_khach)}
          placeholder="Gõ tên/mã khách hàng..."
          disabled={disabled}
        />
      )}

      {cauHinh?.canSanPham && (
        <KpiAutocomplete<string>
          value={form.sanPham || null}
          displayValue={form.sanPham || null}
          onSelect={(sp) => setForm({ ...form, sanPham: sp })}
          onClear={() => setForm({ ...form, sanPham: "" })}
          search={timKiemSanPham}
          getKey={(sp) => sp}
          getLabel={(sp) => sp}
          placeholder="Gõ tên sản phẩm..."
          disabled={disabled}
        />
      )}

      {cauHinh?.canSoLuongKhach && (
        <input
          type="number"
          min={0}
          value={form.soLuongKhachHangKeHoach}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, soLuongKhachHangKeHoach: e.target.value })}
          placeholder="Số lượng khách hàng kế hoạch"
          className={inputClass}
        />
      )}

      {cauHinh?.canSanLuongToiThieu && (
        <input
          type="number"
          min={0}
          value={form.sanLuongKeHoachToiThieu}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, sanLuongKeHoachToiThieu: e.target.value })}
          placeholder="Sản lượng kế hoạch tối thiểu"
          className={inputClass}
        />
      )}

      {cauHinh?.nhom === "doanh_so" && (
        <input
          type="number"
          min={0}
          value={form.soTienKeHoach}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, soTienKeHoach: e.target.value })}
          placeholder="Số tiền kế hoạch (VNĐ)"
          className={inputClass}
        />
      )}

      <input
        type="number"
        min={0}
        value={form.diemKpisKeHoach}
        disabled={disabled}
        onChange={(e) => setForm({ ...form, diemKpisKeHoach: e.target.value })}
        placeholder="Điểm KPI kế hoạch"
        className={inputClass}
      />

      <input
        type="text"
        value={form.ghiChu}
        disabled={disabled}
        onChange={(e) => setForm({ ...form, ghiChu: e.target.value })}
        placeholder="Ghi chú (không bắt buộc)"
        className={`${inputClass} sm:col-span-2 lg:col-span-3`}
      />
    </div>
  );
}

function trangThaiBadge(trangThai: string) {
  return (
    <Badge tone={TRANG_THAI_DUYET_TONE[trangThai] ?? "neutral"}>
      {TRANG_THAI_DUYET_LABEL[trangThai] ?? trangThai}
    </Badge>
  );
}

function moTaDong(row: ChiTieuKpiRow, tenKhach: string | null): string {
  const cauHinh = layCauHinhChiTieu(row.chi_tieu);
  if (cauHinh?.nhom === "doanh_so") {
    const n = Number(row.chi_tiet_ke_hoach_san_pham);
    return Number.isFinite(n) ? `${n.toLocaleString("vi-VN")} đ` : (row.chi_tiet_ke_hoach_san_pham ?? "—");
  }
  const parts: string[] = [];
  if (row.ma_khach) parts.push(ghepTenMa(tenKhach, row.ma_khach));
  if (row.chi_tiet_ke_hoach_san_pham && row.chi_tiet_ke_hoach_san_pham !== cauHinh?.ghiChuMacDinh) {
    parts.push(row.chi_tiet_ke_hoach_san_pham);
  }
  return parts.join(" · ") || "—";
}

function keHoachDong(row: ChiTieuKpiRow): string {
  const cauHinh = layCauHinhChiTieu(row.chi_tieu);
  if (cauHinh?.nhom === "doanh_so") return "—";
  const parts: string[] = [];
  if (row.so_luong_khach_hang_ke_hoach != null) parts.push(`${row.so_luong_khach_hang_ke_hoach} khách`);
  if (row.san_luong_ke_hoach_toi_thieu != null) parts.push(`SL tối thiểu ${row.san_luong_ke_hoach_toi_thieu}`);
  return parts.join(" · ") || "—";
}

export default function KpiXayDung({
  maNhanVien,
  tenNhanVien,
  viTri,
  danhSachNv,
  thangBanDau,
  rowsBanDau,
  tenKhachBanDau,
}: {
  maNhanVien: string;
  tenNhanVien: string;
  viTri: string | null;
  danhSachNv?: { code: string; name: string }[];
  thangBanDau: string;
  rowsBanDau: ChiTieuKpiRow[];
  tenKhachBanDau: Record<string, string>;
}) {
  const coTheChonNv = (viTri === "SS" || viTri === "ASM") && (danhSachNv?.length ?? 0) > 0;

  const [nvDangChon, setNvDangChon] = useState(maNhanVien);
  const [thang, setThang] = useState(thangBanDau);
  const [rows, setRows] = useState<ChiTieuKpiRow[]>(rowsBanDau);
  const [tenKhachMap, setTenKhachMap] = useState<Record<string, string>>(tenKhachBanDau);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<FormState>(FORM_RONG);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const thangOptions = useMemo(
    () => [thangHomNay(), thangSauNay(1)].filter((v, i, a) => a.indexOf(v) === i),
    [],
  );

  async function taiLai(nv: string, t: string) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await layDanhSachKpiTheoThang(nv, t);
      setRows(data);
      const maList = data.map((r) => r.ma_khach).filter((v): v is string => !!v);
      if (maList.length > 0) {
        const map = await layTenKhachTheoMa(maList);
        setTenKhachMap(map);
      } else {
        setTenKhachMap({});
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra khi tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (nvDangChon === maNhanVien && thang === thangBanDau) return; // da co du lieu ban dau
    taiLai(nvDangChon, thang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nvDangChon, thang]);

  const rowsByChiTieu = useMemo(() => {
    const map = new Map<string, ChiTieuKpiRow[]>();
    for (const r of rows) {
      if (!map.has(r.chi_tieu)) map.set(r.chi_tieu, []);
      map.get(r.chi_tieu)!.push(r);
    }
    return map;
  }, [rows]);

  const soDongNhap = rows.filter((r) => r.trang_thai_duyet === "nhap").length;

  function handleThemMoi() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await taoDongKpiNhap(formToInput(nvDangChon, thang, form));
        setForm(FORM_RONG);
        await taiLai(nvDangChon, thang);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function handleLuuSua(id: string) {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await capNhatDongKpiNhap(id, formToInput(nvDangChon, thang, form));
        setEditingId(null);
        setForm(FORM_RONG);
        await taiLai(nvDangChon, thang);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function handleXoa(id: string) {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await xoaDongKpiNhap(id);
        await taiLai(nvDangChon, thang);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function handleGuiDuyet(id: string) {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await guiDuyet(id);
        await taiLai(nvDangChon, thang);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function handleGuiDuyetTatCa() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await guiDuyetTatCa(nvDangChon, thang);
        await taiLai(nvDangChon, thang);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function handleDatNguong(chiTieu: string, nguong: string) {
    setErrorMsg(null);
    const n = Number(nguong);
    if (!Number.isFinite(n) || n <= 0) return;
    startTransition(async () => {
      try {
        await datNguongNhom(nvDangChon, chiTieu, thang, n);
        await taiLai(nvDangChon, thang);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Tháng xây dựng KPI</label>
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
        {coTheChonNv && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Xây dựng cho nhân viên</label>
            <select
              value={nvDangChon}
              onChange={(e) => setNvDangChon(e.target.value)}
              className={inputClass}
            >
              <option value={maNhanVien}>{ghepTenMa(tenNhanVien, maNhanVien)} (tôi)</option>
              {danhSachNv
                ?.filter((nv) => nv.code !== maNhanVien)
                .map((nv) => (
                  <option key={nv.code} value={nv.code}>
                    {ghepTenMa(nv.name, nv.code)}
                  </option>
                ))}
            </select>
          </div>
        )}
        {soDongNhap > 0 && (
          <button
            disabled={isPending}
            onClick={handleGuiDuyetTatCa}
            className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
          >
            Gửi duyệt tất cả ({soDongNhap} dòng nháp)
          </button>
        )}
      </div>

      <Card padding="p-4" className="mb-6">
        <SectionHeading title="Thêm chỉ tiêu mới" />
        <KpiRowForm form={form} setForm={setForm} disabled={isPending} />
        {errorMsg && <p className="mt-2 text-xs text-red-600">{errorMsg}</p>}
        <div className="mt-3">
          <button
            disabled={isPending || !form.diemKpisKeHoach}
            onClick={handleThemMoi}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
          >
            <IconPlus className="h-3.5 w-3.5" /> Thêm dòng
          </button>
        </div>
      </Card>

      {loading && <p className="text-sm text-slate-400">Đang tải…</p>}

      {!loading && rows.length === 0 && (
        <EmptyState>Chưa có chỉ tiêu nào cho {formatThang(thang).toLowerCase()}.</EmptyState>
      )}

      {!loading &&
        Array.from(rowsByChiTieu.entries()).map(([chiTieu, chiTieuRows]) => {
          const cauHinh = layCauHinhChiTieu(chiTieu);
          const nguongHienTai = chiTieuRows.find((r) => r.so_luong_toi_thieu_can_dat != null)
            ?.so_luong_toi_thieu_can_dat;
          return (
            <Card key={chiTieu} padding="p-4" className="mb-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{cauHinh?.nhan ?? chiTieu}</h3>
                {cauHinh?.canNguongNhom && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    Ngưỡng hoàn thành nhóm:
                    <input
                      type="number"
                      min={0}
                      defaultValue={nguongHienTai ?? ""}
                      disabled={isPending}
                      onBlur={(e) => e.target.value && handleDatNguong(chiTieu, e.target.value)}
                      className={`w-16 ${inputClass}`}
                      title={`Số dòng tối thiểu trong nhóm "${chiTieu}" cần đạt để được 100% điểm cả nhóm`}
                    />
                    / {chiTieuRows.length} dòng
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="data-table w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-1.5 pr-3 font-medium">Chi tiết</th>
                      <th className="py-1.5 pr-3 font-medium">Kế hoạch</th>
                      <th className="py-1.5 pr-3 font-medium">Điểm KH</th>
                      <th className="py-1.5 pr-3 font-medium">Trạng thái</th>
                      <th className="py-1.5 font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chiTieuRows.map((row) => {
                      const coTheSua = row.trang_thai_duyet === "nhap" || row.trang_thai_duyet === "tu_choi";
                      const dangSua = editingId === row.id;
                      return (
                        <tr key={row.id} className="border-b border-slate-100 align-top last:border-0">
                          {dangSua ? (
                            <td colSpan={5} className="py-2">
                              <KpiRowForm form={form} setForm={setForm} disabled={isPending} />
                              {errorMsg && <p className="mt-2 text-xs text-red-600">{errorMsg}</p>}
                              <div className="mt-2 flex gap-2">
                                <button
                                  disabled={isPending}
                                  onClick={() => handleLuuSua(row.id)}
                                  className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                                >
                                  Lưu
                                </button>
                                <button
                                  disabled={isPending}
                                  onClick={() => {
                                    setEditingId(null);
                                    setForm(FORM_RONG);
                                    setErrorMsg(null);
                                  }}
                                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                                >
                                  Hủy
                                </button>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="py-2 pr-3 text-slate-800">
                                {moTaDong(row, row.ma_khach ? tenKhachMap[row.ma_khach] ?? null : null)}
                                {row.ghi_chu_duyet && row.trang_thai_duyet === "tu_choi" && (
                                  <p className="mt-0.5 text-[11px] text-red-600">
                                    Lý do từ chối: {row.ghi_chu_duyet}
                                  </p>
                                )}
                              </td>
                              <td className="py-2 pr-3 text-slate-700">{keHoachDong(row)}</td>
                              <td className="py-2 pr-3 text-slate-700">{row.diem_kpis_ke_hoach ?? "—"}</td>
                              <td className="py-2 pr-3">{trangThaiBadge(row.trang_thai_duyet)}</td>
                              <td className="py-2">
                                {coTheSua ? (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      disabled={isPending}
                                      onClick={() => {
                                        setEditingId(row.id);
                                        setForm(rowToForm(row, row.ma_khach ? tenKhachMap[row.ma_khach] ?? null : null));
                                        setErrorMsg(null);
                                      }}
                                      className="text-blue-700 hover:underline"
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      disabled={isPending}
                                      onClick={() => handleGuiDuyet(row.id)}
                                      className="text-emerald-700 hover:underline"
                                    >
                                      Gửi duyệt
                                    </button>
                                    <button
                                      disabled={isPending}
                                      onClick={() => handleXoa(row.id)}
                                      className="text-red-600 hover:underline"
                                    >
                                      Xóa
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">
                                    {row.trang_thai_duyet === "cho_duyet" ? "Đang chờ SS duyệt" : "Đã duyệt, khóa"}
                                  </span>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
    </div>
  );
}
