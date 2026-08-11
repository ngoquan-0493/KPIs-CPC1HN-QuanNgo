"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  duyetDongKpi,
  duyetHangLoatChoNv,
  tuChoiDongKpi,
  datNguongNhomChoDuyet,
  layDanhSachChoDuyet,
  layTenKhachTheoMa,
  type ChiTieuKpiRow,
  type ChoDuyetGroup,
} from "@/app/(app)/kpi/build-actions";
import { layCauHinhChiTieu } from "@/lib/kpi-chi-tieu";
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
  if (row.so_luong_toi_thieu_can_dat != null) parts.push(`ngưỡng nhóm ${row.so_luong_toi_thieu_can_dat}`);
  return parts.join(" · ") || "—";
}

function DongChoDuyet({
  row,
  tenKhach,
  onXongDuyet,
}: {
  row: ChiTieuKpiRow;
  tenKhach: string | null;
  onXongDuyet: () => void;
}) {
  const [tuChoiMode, setTuChoiMode] = useState(false);
  const [lyDo, setLyDo] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDuyet() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await duyetDongKpi(row.id);
        onXongDuyet();
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
        onXongDuyet();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  return (
    <tr className="border-b border-slate-100 align-top last:border-0">
      <td className="py-2 pr-3 text-slate-800">
        <p className="font-medium">{layCauHinhChiTieu(row.chi_tieu)?.nhan ?? row.chi_tieu}</p>
        <p className="text-slate-500">{moTaDong(row, tenKhach)}</p>
      </td>
      <td className="py-2 pr-3 text-slate-700">{keHoachDong(row)}</td>
      <td className="py-2 pr-3 text-slate-700">{row.diem_kpis_ke_hoach ?? "—"}</td>
      <td className="py-2">
        {!tuChoiMode ? (
          <div className="flex flex-wrap gap-2">
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
        {errorMsg && <p className="mt-1 text-[11px] text-red-600">{errorMsg}</p>}
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

  const thangOptions = useMemo(
    () => [thangSauNay(-1), thangHomNay(), thangSauNay(1)].filter((v, i, a) => a.indexOf(v) === i),
    [],
  );

  async function taiLai(t: string) {
    setLoading(true);
    try {
      const data = await layDanhSachChoDuyet(t);
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

  const tongSoDong = groups.reduce((s, g) => s + g.rows.length, 0);

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
      </div>

      <SectionHeading
        title="Chỉ tiêu đang chờ duyệt"
        description={`${formatThang(thang)} · ${groups.length} nhân viên · ${tongSoDong} dòng chờ duyệt`}
      />

      {loading && <p className="text-sm text-slate-400">Đang tải…</p>}

      {!loading && groups.length === 0 && (
        <EmptyState>Không có chỉ tiêu nào đang chờ duyệt cho {formatThang(thang).toLowerCase()}.</EmptyState>
      )}

      <div className="space-y-4">
        {groups.map((g) => (
          <Card key={g.ma_nhan_vien} padding="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                {ghepTenMa(tenNhanVienMap[g.ma_nhan_vien], g.ma_nhan_vien)}
              </h3>
              <div className="flex items-center gap-2">
                <Badge tone="warning">{g.rows.length} dòng chờ duyệt</Badge>
                <button
                  disabled={isPending}
                  onClick={() => handleDuyetTatCa(g.ma_nhan_vien)}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Duyệt tất cả
                </button>
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
                  return (
                    <div key={chiTieu} className="flex items-center gap-1.5 text-xs text-slate-600">
                      {nguongHienTai == null && <Badge tone="warning">Chưa đặt</Badge>}
                      <span>{layCauHinhChiTieu(chiTieu)?.nhan ?? chiTieu} — Ngưỡng hoàn thành nhóm:</span>
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
                    <th className="py-1.5 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((row) => (
                    <DongChoDuyet
                      key={row.id}
                      row={row}
                      tenKhach={row.ma_khach ? tenKhachMap[row.ma_khach] ?? null : null}
                      onXongDuyet={() => taiLai(thang)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
