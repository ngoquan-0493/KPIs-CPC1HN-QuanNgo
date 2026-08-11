"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import {
  approveDeXuat,
  huyDeXuat,
  dieuChinhDeXuat,
  addManualTask,
  duyetWeeklyReview,
  xacNhanKetQua,
  revertDeXuat,
  nvXacNhanNhanViec,
  nvTuChoiDeXuat,
  getChiTietKhachHangRuiRo,
  getChamCongTrongTuan,
  getDonHangTrongTuan,
  type KhachHangRuiRo,
  type ChamCongDoiChieu,
  type DonHangDoiChieu,
} from "@/app/(app)/ai-review/actions";
import { Card, Badge } from "@/components/ui";
import { IconPlus } from "@/components/icons";

type PendingFeedback = {
  id: number;
  ma_nhan_vien_thuc_hien: string;
  hanh_dong_goc: string | null;
  ma_ss: string | null;
  kenh: string | null;
  nhom_khach_hang: string | null;
  san_pham: string | null;
  ket_qua_du_kien: string | null;
  review_id: number | null;
  tuan_bat_dau: string | null;
  ly_do_chinh_sua?: string | null;
  so_lan_chinh_sua?: number | null;
};

const inputClass =
  "rounded-lg border border-slate-200 p-2 text-xs outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-xs text-slate-600">
      <span className="font-medium text-slate-500">{label}:</span> {value}
    </p>
  );
}

function ruiRoBadgeColor(muc: string | null) {
  if (muc === "P1") return "bg-red-100 text-red-700";
  if (muc === "P2") return "bg-amber-100 text-amber-700";
  if (muc === "P3") return "bg-slate-200 text-slate-600";
  return "bg-slate-100 text-slate-500";
}

function trangThaiNhipLabel(t: string | null) {
  if (t === "overdue") return "Quá hạn";
  if (t === "followup_due") return "Tới hạn theo dõi";
  if (t === "inactive") return "Không hoạt động";
  return t ?? "—";
}

function KhachHangRuiRoTable({
  loading,
  rows,
}: {
  loading: boolean;
  rows: KhachHangRuiRo[] | null;
}) {
  if (loading) {
    return <p className="mt-2 text-xs text-slate-400">Đang tải danh sách khách hàng…</p>;
  }
  if (rows === null) return null;
  if (rows.length === 0) {
    return (
      <p className="mt-2 text-xs text-slate-400">
        Không có dữ liệu khách hàng rủi ro/quá hạn chi tiết cho nhân viên này.
      </p>
    );
  }
  const countP1 = rows.filter((r) => r.muc_do_rui_ro === "P1").length;
  const countP2 = rows.filter((r) => r.muc_do_rui_ro === "P2").length;
  const countOverdue = rows.filter((r) => r.trang_thai_nhip === "overdue").length;
  return (
    <div className="mt-3">
      <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
          Tổng {rows.length} khách
        </span>
        {countOverdue > 0 && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">
            Quá hạn: {countOverdue}
          </span>
        )}
        {countP1 > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
            P1: {countP1}
          </span>
        )}
        {countP2 > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
            P2: {countP2}
          </span>
        )}
      </div>
      <div className="data-table max-h-72 overflow-y-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-slate-100 text-slate-500">
            <tr>
              <th className="px-2 py-1.5 font-medium">Khách hàng</th>
              <th className="px-2 py-1.5 font-medium">Nhóm</th>
              <th className="px-2 py-1.5 font-medium">Mức</th>
              <th className="px-2 py-1.5 font-medium">Trạng thái</th>
              <th className="px-2 py-1.5 font-medium">Lý do</th>
              <th className="px-2 py-1.5 font-medium">Tương tác gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ma_khach} className="border-t border-slate-100">
                <td className="px-2 py-1.5">
                  <p className="font-medium text-slate-800">{r.ten_khach ?? r.ma_khach}</p>
                  <p className="text-slate-400">{r.ma_khach}</p>
                </td>
                <td className="px-2 py-1.5 text-slate-600">{r.nhom_khach_hang ?? "—"}</td>
                <td className="px-2 py-1.5">
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-medium ${ruiRoBadgeColor(r.muc_do_rui_ro)}`}
                  >
                    {r.muc_do_rui_ro ?? "—"}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-slate-600">{trangThaiNhipLabel(r.trang_thai_nhip)}</td>
                <td className="px-2 py-1.5 text-slate-600">{r.ly_do_rui_ro ?? "—"}</td>
                <td className="px-2 py-1.5 text-slate-600">{r.ngay_tuong_tac_gan_nhat ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DeXuatCard({
  feedback,
  employeeName,
  ssName,
  hideEmployeeName = false,
}: {
  feedback: PendingFeedback;
  employeeName: string;
  ssName: string | null;
  hideEmployeeName?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showHuy, setShowHuy] = useState(false);
  const [lyDoHuy, setLyDoHuy] = useState("");
  const [showDieuChinh, setShowDieuChinh] = useState(false);
  const [ghiChuDieuChinh, setGhiChuDieuChinh] = useState("");
  const [maKhachDieuChinh, setMaKhachDieuChinh] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [khachHangRows, setKhachHangRows] = useState<KhachHangRuiRo[] | null>(null);
  const [loadingKhachHang, setLoadingKhachHang] = useState(false);
  const [maKhachCanTapTrung, setMaKhachCanTapTrung] = useState("");

  function handleToggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && khachHangRows === null && !loadingKhachHang) {
      setLoadingKhachHang(true);
      getChiTietKhachHangRuiRo(feedback.ma_nhan_vien_thuc_hien)
        .then(setKhachHangRows)
        .catch(() => setKhachHangRows([]))
        .finally(() => setLoadingKhachHang(false));
    }
  }

  function handleApprove() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await approveDeXuat(feedback.id, maKhachCanTapTrung);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function handleHuySubmit() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await huyDeXuat(feedback.id, lyDoHuy);
        setShowHuy(false);
        setLyDoHuy("");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function handleDieuChinhSubmit() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await dieuChinhDeXuat(feedback.id, ghiChuDieuChinh, maKhachDieuChinh);
        setShowDieuChinh(false);
        setGhiChuDieuChinh("");
        setMaKhachDieuChinh("");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  return (
    <Card padding="p-3.5">
      <button
        type="button"
        onClick={handleToggleExpand}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          {!hideEmployeeName && (
            <p className="text-sm font-medium text-slate-900">{employeeName}</p>
          )}
          <p className="truncate text-xs text-slate-600">{feedback.hanh_dong_goc ?? "—"}</p>
        </div>
        <span className="shrink-0 text-xs text-slate-400">{expanded ? "Thu gọn ▲" : "Chi tiết ▼"}</span>
      </button>

      {!!feedback.so_lan_chinh_sua && feedback.so_lan_chinh_sua > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
          Đã được gửi lại {feedback.so_lan_chinh_sua} lần
          {feedback.ly_do_chinh_sua ? ` — lý do gần nhất: ${feedback.ly_do_chinh_sua}` : ""}
        </p>
      )}

      {expanded && (
        <div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3">
          <p className="mb-1 text-sm text-slate-800">{feedback.hanh_dong_goc ?? "—"}</p>
          <DetailRow label="Nhân viên" value={employeeName} />
          <DetailRow label="SS" value={ssName} />
          <DetailRow label="Kênh" value={feedback.kenh} />
          <DetailRow label="Nhóm khách hàng" value={feedback.nhom_khach_hang} />
          <DetailRow label="Sản phẩm" value={feedback.san_pham} />
          <DetailRow label="Kết quả dự kiến" value={feedback.ket_qua_du_kien} />
          <DetailRow label="Tuần" value={feedback.tuan_bat_dau} />
          <KhachHangRuiRoTable loading={loadingKhachHang} rows={khachHangRows} />
        </div>
      )}

      {errorMsg && <p className="mt-2 text-xs text-red-600">{errorMsg}</p>}

      <input
        type="text"
        value={maKhachCanTapTrung}
        onChange={(e) => setMaKhachCanTapTrung(e.target.value)}
        placeholder="Không bắt buộc: mã khách cần tập trung, cách nhau bằng dấu phẩy (vd: P06561, C01177)"
        className={`mt-3 w-full ${inputClass}`}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          disabled={isPending}
          onClick={handleApprove}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          Duyệt
        </button>
        <button
          disabled={isPending}
          onClick={() => {
            setShowDieuChinh((v) => !v);
            setShowHuy(false);
          }}
          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
        >
          Điều chỉnh
        </button>
        <button
          disabled={isPending}
          onClick={() => {
            setShowHuy((v) => !v);
            setShowDieuChinh(false);
          }}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
        >
          Hủy
        </button>
      </div>

      {showDieuChinh && (
        <div className="mt-3 space-y-2 rounded-xl bg-amber-50 p-3">
          <p className="text-xs text-amber-800">
            Vẫn tạo việc thật cho nhân viên, nhưng thay nội dung chung chung của AI bằng hướng dẫn
            cụ thể của bạn — bắt buộc nêu rõ mã khách hàng cần tập trung để bước xác nhận kết quả
            sau này đối chiếu đúng từng khách.
          </p>
          <textarea
            value={ghiChuDieuChinh}
            onChange={(e) => setGhiChuDieuChinh(e.target.value)}
            placeholder="Không bắt buộc: hướng dẫn cụ thể cho nhân viên (nếu để trống sẽ giữ nội dung gốc của AI)..."
            rows={2}
            className={`w-full ${inputClass}`}
          />
          <input
            type="text"
            value={maKhachDieuChinh}
            onChange={(e) => setMaKhachDieuChinh(e.target.value)}
            placeholder="Bắt buộc: mã khách cần tập trung, cách nhau bằng dấu phẩy (vd: P06561, C01177)"
            className={`w-full ${inputClass}`}
          />
          <div className="flex gap-2">
            <button
              disabled={isPending || !maKhachDieuChinh.trim()}
              onClick={handleDieuChinhSubmit}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              Xác nhận điều chỉnh
            </button>
            <button
              disabled={isPending}
              onClick={() => {
                setShowDieuChinh(false);
                setGhiChuDieuChinh("");
                setMaKhachDieuChinh("");
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Hủy thao tác
            </button>
          </div>
        </div>
      )}

      {showHuy && (
        <div className="mt-3 space-y-2">
          <textarea
            value={lyDoHuy}
            onChange={(e) => setLyDoHuy(e.target.value)}
            placeholder="Bắt buộc: vì sao hủy đề xuất này (không còn phù hợp, NV nghỉ việc, ý tưởng chung chung...)? AI sẽ dùng lý do này để học."
            rows={2}
            className={`w-full ${inputClass}`}
          />
          <div className="flex gap-2">
            <button
              disabled={isPending || !lyDoHuy.trim()}
              onClick={handleHuySubmit}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              Xác nhận hủy
            </button>
            <button
              disabled={isPending}
              onClick={() => {
                setShowHuy(false);
                setLyDoHuy("");
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function ThemViecMoiForm({
  employees,
  defaultWeekStart,
  defaultWeekEnd,
}: {
  employees: { code: string; name: string }[];
  defaultWeekStart: string;
  defaultWeekEnd: string;
}) {
  const [maNhanVien, setMaNhanVien] = useState("");
  const [noiDung, setNoiDung] = useState("");
  const [tuanBatDau, setTuanBatDau] = useState(defaultWeekStart);
  const [hanHoanThanh, setHanHoanThanh] = useState(defaultWeekEnd);
  const [open, setOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await addManualTask({ maNhanVien, noiDung, tuanBatDau, hanHoanThanh });
        setNoiDung("");
        setMaNhanVien("");
        setOpen(false);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
      >
        <IconPlus className="h-3.5 w-3.5" /> Thêm việc mới
      </button>
    );
  }

  return (
    <Card padding="p-3.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          value={maNhanVien}
          onChange={(e) => setMaNhanVien(e.target.value)}
          className={inputClass}
        >
          <option value="">— Chọn nhân viên —</option>
          {employees.map((e) => (
            <option key={e.code} value={e.code}>
              {e.name} ({e.code})
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            value={tuanBatDau}
            onChange={(e) => setTuanBatDau(e.target.value)}
            className={`w-1/2 ${inputClass}`}
            title="Tuần bắt đầu"
          />
          <input
            type="date"
            value={hanHoanThanh}
            onChange={(e) => setHanHoanThanh(e.target.value)}
            className={`w-1/2 ${inputClass}`}
            title="Hạn hoàn thành"
          />
        </div>
      </div>
      <textarea
        value={noiDung}
        onChange={(e) => setNoiDung(e.target.value)}
        placeholder="Nội dung việc..."
        rows={2}
        className={`mt-2 w-full ${inputClass}`}
      />
      {errorMsg && <p className="mt-2 text-xs text-red-600">{errorMsg}</p>}
      <div className="mt-2 flex gap-2">
        <button
          disabled={isPending || !maNhanVien || !noiDung.trim()}
          onClick={handleSubmit}
          className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
        >
          Thêm việc
        </button>
        <button
          disabled={isPending}
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
        >
          Hủy
        </button>
      </div>
    </Card>
  );
}

function chamCongLabel(t: string | null) {
  if (t === "cho_xac_nhan" || !t) return { text: "Chờ NV xác nhận nhận việc", tone: "warning" as const };
  if (t === "da_xac_nhan") return { text: "NV đã xác nhận nhận việc", tone: "success" as const };
  return { text: t, tone: "neutral" as const };
}

function ChamCongDoiChieuList({ rows, loading }: { rows: ChamCongDoiChieu[] | null; loading: boolean }) {
  if (loading) return <p className="mt-2 text-xs text-slate-400">Đang tải dữ liệu chấm công…</p>;
  if (rows === null) return null;
  if (rows.length === 0) {
    return (
      <p className="mt-2 text-xs text-slate-400">
        Không có dữ liệu chấm công nào của nhân viên này trong khoảng thời gian của việc.
      </p>
    );
  }
  return (
    <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
      {rows.map((r, i) => (
        <div key={i} className="rounded-lg bg-white p-2 text-[11px] shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-800">{r.ten_khach_hang ?? r.ma_khach ?? "—"}</span>
            <span className="shrink-0 text-slate-400">
              {r.thoi_gian_checkin ? new Date(r.thoi_gian_checkin).toLocaleString("vi-VN") : "—"}
            </span>
          </div>
          {r.ten_nhiem_vu && <p className="text-slate-500">{r.ten_nhiem_vu}</p>}
          {r.bao_cao && <p className="mt-1 text-slate-600">Báo cáo: {r.bao_cao}</p>}
          {r.ket_qua && <p className="text-slate-600">Kết quả: {r.ket_qua}</p>}
        </div>
      ))}
    </div>
  );
}

function formatTien(n: number | null) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("vi-VN");
}

function DonHangDoiChieuList({ rows, loading }: { rows: DonHangDoiChieu[] | null; loading: boolean }) {
  if (loading) return <p className="mt-2 text-xs text-slate-400">Đang tải dữ liệu đơn hàng…</p>;
  if (rows === null) return null;
  if (rows.length === 0) {
    return (
      <p className="mt-2 text-xs text-slate-400">
        Không có đơn hàng nào của nhân viên này trong khoảng thời gian của việc.
      </p>
    );
  }
  const tongDoanhThu = rows.reduce((s, r) => s + (r.doanh_thu ?? 0), 0);
  return (
    <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
      <div className="rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-800">
        Tổng doanh thu trong khoảng thời gian: {formatTien(tongDoanhThu)}
      </div>
      {rows.map((r, i) => (
        <div key={i} className="rounded-lg bg-white p-2 text-[11px] shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-800">{r.ten_khach ?? r.ma_khach ?? "—"}</span>
            <span className="shrink-0 text-slate-400">{r.ngay ?? "—"}</span>
          </div>
          {r.ten_mat_hang && (
            <p className="text-slate-500">
              {r.ten_mat_hang} — SL {r.so_luong ?? "—"} × {formatTien(r.gia_ban)}
            </p>
          )}
          <p className="mt-1 font-medium text-emerald-700">Doanh thu: {formatTien(r.doanh_thu)}</p>
          {r.kenh && <p className="text-slate-400">Kênh: {r.kenh}</p>}
        </div>
      ))}
    </div>
  );
}

// Do ma khach hang (vd: P06561, C01177 - 1 chu cai + 5 chu so, dung format
// thuc te cua khach_hang_master) xuat hien trong 1 hoac nhieu doan text -
// dung de nhan dien de xuat "cu the theo khach" (AI ghi thang trong
// hanh_dong_goc, hoac SS/ASM tu go them luc duyet vao ma_khach_can_tap_trung)
// khac voi de xuat "chung chung" (khong co ma khach nao).
function trichMaKhach(...texts: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    const matches = t.toUpperCase().match(/\b[A-Z]\d{5}\b/g);
    matches?.forEach((m) => found.add(m));
  }
  return Array.from(found);
}

// Neu de xuat neu ro khach hang can tap trung (maKhachList khong rong): hien
// so lan ghe + chi tiet don hang RIENG cho tung khach do. Neu de xuat chung
// chung (khong ma khach nao): chi hien so tong quan ca tuan, khong can liet
// ke tung dong - dung nhu yeu cau cua ASM (do xuat cu the can doi chieu sau,
// do xuat chung chung chi can biet tong the co on khong).
function DoiChieuTomTat({
  maKhachList,
  chamCongRows,
  donHangRows,
  loadingChamCong,
  loadingDonHang,
}: {
  maKhachList: string[];
  chamCongRows: ChamCongDoiChieu[] | null;
  donHangRows: DonHangDoiChieu[] | null;
  loadingChamCong: boolean;
  loadingDonHang: boolean;
}) {
  if (loadingChamCong || loadingDonHang) {
    return <p className="mt-2 text-xs text-slate-400">Đang tải dữ liệu đối chiếu…</p>;
  }
  if (chamCongRows === null || donHangRows === null) return null;

  if (maKhachList.length > 0) {
    return (
      <div className="mt-2 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2">
        <p className="text-[11px] font-medium text-slate-600">
          Đề xuất nêu rõ khách hàng cần tập trung — đối chiếu riêng từng khách:
        </p>
        {maKhachList.map((ma) => {
          const gheTham = chamCongRows.filter((r) => (r.ma_khach ?? "").toUpperCase() === ma);
          const donHang = donHangRows.filter((r) => (r.ma_khach ?? "").toUpperCase() === ma);
          const tongDoanhThu = donHang.reduce((s, r) => s + (r.doanh_thu ?? 0), 0);
          const ten = gheTham[0]?.ten_khach_hang ?? donHang[0]?.ten_khach ?? null;
          return (
            <div key={ma} className="rounded-lg bg-white p-2 text-[11px] shadow-sm">
              <p className="font-medium text-slate-800">
                {ma}
                {ten ? ` — ${ten}` : ""}
              </p>
              <p className="text-slate-600">
                Ghé thăm: <span className="font-medium">{gheTham.length} lần</span> · Đơn hàng:{" "}
                <span className="font-medium">{donHang.length}</span> · Doanh thu:{" "}
                <span className="font-medium text-emerald-700">{formatTien(tongDoanhThu)}</span>
              </p>
              {donHang.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {donHang.map((r, i) => (
                    <p key={i} className="text-slate-500">
                      {r.ngay ?? "—"} · {r.ten_mat_hang ?? "—"} · SL {r.so_luong ?? "—"} ·{" "}
                      {formatTien(r.doanh_thu)}
                    </p>
                  ))}
                </div>
              )}
              {gheTham.length === 0 && donHang.length === 0 && (
                <p className="text-amber-600">
                  Chưa ghé thăm, chưa có đơn hàng nào của khách này trong tuần.
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const tongDoanhThu = donHangRows.reduce((s, r) => s + (r.doanh_thu ?? 0), 0);
  return (
    <div className="mt-2 rounded-xl bg-slate-50 p-2 text-[11px] text-slate-700">
      Đề xuất chung chung — tổng quan trong tuần: <span className="font-medium">{chamCongRows.length}</span>{" "}
      lượt ghé thăm · <span className="font-medium">{donHangRows.length}</span> đơn hàng ·{" "}
      <span className="font-medium text-emerald-700">{formatTien(tongDoanhThu)}</span> doanh thu
    </div>
  );
}

export function XacNhanKetQuaCard({
  feedback,
  employeeName,
  hanHoanThanh,
  tuanBatDau,
  trangThaiNv,
  maKhach,
}: {
  feedback: { id: number; hanh_dong_goc: string | null; ma_nhan_vien_thuc_hien: string };
  employeeName: string;
  hanHoanThanh: string | null;
  tuanBatDau: string | null;
  trangThaiNv: string | null;
  maKhach?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [thanhCong, setThanhCong] = useState<boolean | null>(null);
  const [ghiChu, setGhiChu] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [lyDoChinhSua, setLyDoChinhSua] = useState("");
  const [showChamCong, setShowChamCong] = useState(false);
  const [chamCongRows, setChamCongRows] = useState<ChamCongDoiChieu[] | null>(null);
  const [loadingChamCong, setLoadingChamCong] = useState(false);
  const [showDonHang, setShowDonHang] = useState(false);
  const [donHangRows, setDonHangRows] = useState<DonHangDoiChieu[] | null>(null);
  const [loadingDonHang, setLoadingDonHang] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !!hanHoanThanh && hanHoanThanh < today;
  // Chi mo khoa "Xac nhan ket qua" khi NV da xac nhan nhan viec, hoac da qua
  // han ma NV chua phan hoi (leo thang - dung nhu guard trong xacNhanKetQua).
  const coTheXacNhanKetQua = trangThaiNv === "da_xac_nhan" || isOverdue;
  const nhanNv = chamCongLabel(trangThaiNv);

  // Uu tien cot ma_khach co cau truc (moi dong = 1 khach hang - san pham, ke
  // tu khi tach dong). Fallback ve do chu trong hanh_dong_goc chi de phong
  // du lieu cu/WF12 chua kip cap nhat con de lai text tu do co ma khach.
  const maKhachList = useMemo(
    () => (maKhach ? [maKhach.toUpperCase()] : trichMaKhach(feedback.hanh_dong_goc)),
    [feedback.hanh_dong_goc, maKhach],
  );

  // Tu dong tai du lieu doi chieu (khong doi nguoi dung phai bam nut) ngay
  // khi biet duoc khoang ngay cua viec, de luon co can cu ngay trong phan
  // "Ket qua" - nut Xem chi tiet ben duoi chi la bat/tat hien thi danh sach
  // day du, khong quyet dinh co tai du lieu hay khong nua.
  useEffect(() => {
    if (!tuanBatDau || !hanHoanThanh) return;

    async function loadChamCong() {
      setLoadingChamCong(true);
      try {
        const rows = await getChamCongTrongTuan(
          feedback.ma_nhan_vien_thuc_hien,
          tuanBatDau!,
          hanHoanThanh!,
        );
        setChamCongRows(rows);
      } catch {
        setChamCongRows([]);
      } finally {
        setLoadingChamCong(false);
      }
    }

    async function loadDonHang() {
      setLoadingDonHang(true);
      try {
        const rows = await getDonHangTrongTuan(
          feedback.ma_nhan_vien_thuc_hien,
          tuanBatDau!,
          hanHoanThanh!,
        );
        setDonHangRows(rows);
      } catch {
        setDonHangRows([]);
      } finally {
        setLoadingDonHang(false);
      }
    }

    loadChamCong();
    loadDonHang();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback.ma_nhan_vien_thuc_hien, tuanBatDau, hanHoanThanh]);

  function handleToggleChamCong() {
    setShowChamCong((v) => !v);
  }

  function handleToggleDonHang() {
    setShowDonHang((v) => !v);
  }

  function handleSubmit() {
    if (thanhCong === null) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await xacNhanKetQua(feedback.id, thanhCong, ghiChu);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function handleRevert() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await revertDeXuat(feedback.id, lyDoChinhSua);
        setConfirmRevert(false);
        setLyDoChinhSua("");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  return (
    <Card padding="p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{employeeName}</p>
          <p className="text-xs text-slate-600">{feedback.hanh_dong_goc ?? "—"}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={nhanNv.tone}>{nhanNv.text}</Badge>
            {hanHoanThanh && (
              <span className={`text-[11px] ${isOverdue ? "font-medium text-red-600" : "text-slate-400"}`}>
                Hạn hoàn thành: {hanHoanThanh}
                {isOverdue ? " (đã quá hạn — có thể xác nhận thay)" : ""}
              </span>
            )}
          </div>
        </div>
        {!open && !confirmRevert && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setOpen(true)}
              disabled={!coTheXacNhanKetQua}
              title={
                coTheXacNhanKetQua ? undefined : "Chờ nhân viên xác nhận nhận việc, hoặc đợi quá hạn"
              }
              className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              Xác nhận kết quả
            </button>
            <button
              disabled={isPending}
              onClick={() => setConfirmRevert(true)}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
            >
              Chỉnh sửa
            </button>
          </div>
        )}
      </div>

      {!confirmRevert && (
        <DoiChieuTomTat
          maKhachList={maKhachList}
          chamCongRows={chamCongRows}
          donHangRows={donHangRows}
          loadingChamCong={loadingChamCong}
          loadingDonHang={loadingDonHang}
        />
      )}

      {!confirmRevert && (
        <div className="mt-1.5 flex flex-wrap gap-3">
          <button
            onClick={handleToggleChamCong}
            className="text-[11px] font-medium text-blue-700 hover:underline"
          >
            {showChamCong ? "Ẩn danh sách chấm công ▲" : "Xem toàn bộ danh sách chấm công ▼"}
          </button>
          <button
            onClick={handleToggleDonHang}
            className="text-[11px] font-medium text-emerald-700 hover:underline"
          >
            {showDonHang ? "Ẩn danh sách đơn hàng ▲" : "Xem toàn bộ danh sách đơn hàng ▼"}
          </button>
        </div>
      )}

      {showChamCong && !confirmRevert && (
        <ChamCongDoiChieuList rows={chamCongRows} loading={loadingChamCong} />
      )}
      {showDonHang && !confirmRevert && (
        <DonHangDoiChieuList rows={donHangRows} loading={loadingDonHang} />
      )}

      {confirmRevert && !open && (
        <div className="mt-3 space-y-2 rounded-xl bg-amber-50 p-3">
          <p className="text-xs text-amber-800">
            Đưa đề xuất này quay lại mục &quot;Đang chờ duyệt&quot;? Công việc đã tạo sẽ bị hủy
            (không xóa) — nếu duyệt lại, một công việc mới đúng tuần hiện tại sẽ được tạo.
          </p>
          <textarea
            value={lyDoChinhSua}
            onChange={(e) => setLyDoChinhSua(e.target.value)}
            placeholder="Bắt buộc: vì sao cần đưa đề xuất này về chờ duyệt lại (duyệt nhầm, sai nhân viên, sai tuần...)? AI sẽ dùng lý do này để học."
            rows={2}
            className={`w-full ${inputClass}`}
          />
          {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
          <div className="flex gap-2">
            <button
              disabled={isPending || !lyDoChinhSua.trim()}
              onClick={handleRevert}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              Xác nhận đưa về chờ duyệt
            </button>
            <button
              disabled={isPending}
              onClick={() => {
                setConfirmRevert(false);
                setLyDoChinhSua("");
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setThanhCong(true)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                thanhCong === true
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              ✓ Thành công
            </button>
            <button
              type="button"
              onClick={() => setThanhCong(false)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                thanhCong === false
                  ? "bg-red-600 text-white"
                  : "bg-red-50 text-red-700 hover:bg-red-100"
              }`}
            >
              ✗ Chưa thành công
            </button>
          </div>
          <textarea
            value={ghiChu}
            onChange={(e) => setGhiChu(e.target.value)}
            placeholder={
              thanhCong === false
                ? "Bắt buộc: kết quả thực tế / vì sao chưa thành công..."
                : "Không bắt buộc: ghi chú kết quả thực tế..."
            }
            rows={2}
            className={`w-full ${inputClass}`}
          />
          {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
          <div className="flex gap-2">
            <button
              disabled={isPending || thanhCong === null || (thanhCong === false && !ghiChu.trim())}
              onClick={handleSubmit}
              className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
            >
              Lưu xác nhận
            </button>
            <button
              disabled={isPending}
              onClick={() => {
                setOpen(false);
                setThanhCong(null);
                setGhiChu("");
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function DuyetWeeklyReviewButton({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => duyetWeeklyReview(id))}
      className="shrink-0 rounded-full bg-blue-700 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
    >
      Đã xem, duyệt
    </button>
  );
}

// Card cho NV phan hoi 1 de xuat DA DUYET boi SS/ASM: Xac nhan (cam ket se
// lam - mo khoa buoc SS/ASM xac nhan ket qua sau nay), Chinh sua (tai dung
// dung co che revertDeXuat, dua de xuat ve "cho duyet"), hoac Tu choi (kem
// ly do bat buoc, AI ghi nhan).
export function NvDeXuatCard({
  feedback,
}: {
  feedback: {
    id: number;
    hanh_dong_goc: string | null;
    kenh: string | null;
    nhom_khach_hang: string | null;
    san_pham: string | null;
    ket_qua_du_kien: string | null;
    tuan_bat_dau: string | null;
  };
}) {
  const [mode, setMode] = useState<"none" | "sua" | "tu_choi">("none");
  const [lyDo, setLyDo] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleXacNhan() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await nvXacNhanNhanViec(feedback.id);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function handleSua() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await revertDeXuat(feedback.id, lyDo);
        setMode("none");
        setLyDo("");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function handleTuChoi() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await nvTuChoiDeXuat(feedback.id, lyDo);
        setMode("none");
        setLyDo("");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  return (
    <Card padding="p-3.5">
      <p className="mb-1 text-sm text-slate-800">{feedback.hanh_dong_goc ?? "—"}</p>
      <DetailRow label="Kênh" value={feedback.kenh} />
      <DetailRow label="Nhóm khách hàng" value={feedback.nhom_khach_hang} />
      <DetailRow label="Sản phẩm" value={feedback.san_pham} />
      <DetailRow label="Kết quả dự kiến" value={feedback.ket_qua_du_kien} />
      <DetailRow label="Tuần" value={feedback.tuan_bat_dau} />

      {errorMsg && <p className="mt-2 text-xs text-red-600">{errorMsg}</p>}

      {mode === "none" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            disabled={isPending}
            onClick={handleXacNhan}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            ✓ Xác nhận, tôi sẽ làm
          </button>
          <button
            disabled={isPending}
            onClick={() => setMode("sua")}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
          >
            Chỉnh sửa
          </button>
          <button
            disabled={isPending}
            onClick={() => setMode("tu_choi")}
            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            Từ chối
          </button>
        </div>
      )}

      {mode === "sua" && (
        <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-600">
            Đề xuất sẽ quay lại mục &quot;chờ duyệt&quot; để SS/ASM xem lại — nêu rõ vì sao (sai
            khách hàng, sai sản phẩm, không phù hợp...).
          </p>
          <textarea
            value={lyDo}
            onChange={(e) => setLyDo(e.target.value)}
            placeholder="Bắt buộc: vì sao cần chỉnh sửa đề xuất này?"
            rows={2}
            className={`w-full ${inputClass}`}
          />
          <div className="flex gap-2">
            <button
              disabled={isPending || !lyDo.trim()}
              onClick={handleSua}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              Gửi yêu cầu chỉnh sửa
            </button>
            <button
              disabled={isPending}
              onClick={() => {
                setMode("none");
                setLyDo("");
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {mode === "tu_choi" && (
        <div className="mt-3 space-y-2 rounded-xl bg-red-50 p-3">
          <p className="text-xs text-red-800">
            Từ chối đề xuất này? Việc đã tạo sẽ bị hủy, và lý do sẽ được ghi nhận để AI học lại.
          </p>
          <textarea
            value={lyDo}
            onChange={(e) => setLyDo(e.target.value)}
            placeholder="Bắt buộc: vì sao bạn từ chối đề xuất này?"
            rows={2}
            className={`w-full ${inputClass}`}
          />
          <div className="flex gap-2">
            <button
              disabled={isPending || !lyDo.trim()}
              onClick={handleTuChoi}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              Xác nhận từ chối
            </button>
            <button
              disabled={isPending}
              onClick={() => {
                setMode("none");
                setLyDo("");
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// Dong hien thi don gian, chi doc, cho cac muc "dang cho xu ly" / "lich su"
// trong trang "Viec cua toi" cua NV.
export function NvViecCuaToiCard({
  noiDung,
  trangThai,
  tone,
}: {
  noiDung: string | null;
  trangThai: string;
  tone: "neutral" | "success" | "warning" | "danger" | "brand";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs">
      <span className="min-w-0 truncate text-slate-700">{noiDung ?? "—"}</span>
      <span className="shrink-0">
        <Badge tone={tone}>{trangThai}</Badge>
      </span>
    </div>
  );
}
