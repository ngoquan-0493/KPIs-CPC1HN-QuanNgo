"use client";

import { useState, useTransition } from "react";
import {
  approveDeXuat,
  adjustDeXuat,
  addManualTask,
  duyetWeeklyReview,
  xacNhanKetQua,
  getChiTietKhachHangRuiRo,
  type KhachHangRuiRo,
} from "@/app/(app)/ai-review/actions";
import { Card } from "@/components/ui";
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
}: {
  feedback: PendingFeedback;
  employeeName: string;
  ssName: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [lyDo, setLyDo] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [khachHangRows, setKhachHangRows] = useState<KhachHangRuiRo[] | null>(null);
  const [loadingKhachHang, setLoadingKhachHang] = useState(false);

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
        await approveDeXuat(feedback.id);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function handleAdjustSubmit() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await adjustDeXuat(feedback.id, lyDo);
        setShowAdjust(false);
        setLyDo("");
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
          <p className="text-sm font-medium text-slate-900">{employeeName}</p>
          <p className="truncate text-xs text-slate-600">{feedback.hanh_dong_goc ?? "—"}</p>
        </div>
        <span className="shrink-0 text-xs text-slate-400">{expanded ? "Thu gọn ▲" : "Chi tiết ▼"}</span>
      </button>

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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          disabled={isPending}
          onClick={handleApprove}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          Duyệt
        </button>
        <button
          disabled={isPending}
          onClick={() => setShowAdjust((v) => !v)}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
        >
          Bỏ / điều chỉnh
        </button>
      </div>

      {showAdjust && (
        <div className="mt-3 space-y-2">
          <textarea
            value={lyDo}
            onChange={(e) => setLyDo(e.target.value)}
            placeholder="Nhập lý do bỏ/điều chỉnh đề xuất này..."
            rows={2}
            className={`w-full ${inputClass}`}
          />
          <div className="flex gap-2">
            <button
              disabled={isPending || !lyDo.trim()}
              onClick={handleAdjustSubmit}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              Xác nhận bỏ/điều chỉnh
            </button>
            <button
              disabled={isPending}
              onClick={() => {
                setShowAdjust(false);
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

export function XacNhanKetQuaCard({
  feedback,
  employeeName,
  hanHoanThanh,
}: {
  feedback: { id: number; hanh_dong_goc: string | null };
  employeeName: string;
  hanHoanThanh: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [thanhCong, setThanhCong] = useState<boolean | null>(null);
  const [ghiChu, setGhiChu] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !!hanHoanThanh && hanHoanThanh < today;

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

  return (
    <Card padding="p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{employeeName}</p>
          <p className="text-xs text-slate-600">{feedback.hanh_dong_goc ?? "—"}</p>
          {hanHoanThanh && (
            <p className={`mt-1 text-[11px] ${isOverdue ? "font-medium text-red-600" : "text-slate-400"}`}>
              Hạn hoàn thành: {hanHoanThanh}
              {isOverdue ? " (đã quá hạn)" : ""}
            </p>
          )}
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-800"
          >
            Xác nhận kết quả
          </button>
        )}
      </div>

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
