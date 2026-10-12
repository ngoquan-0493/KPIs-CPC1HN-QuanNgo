"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, EmptyState } from "@/components/ui";
import {
  NHAN_TRANG_THAI,
  fmtNgay,
  fmtPct,
  fmtSo,
  tinhTrangThai,
  type LapDonCap,
  type LapDonNgoai,
  type SanPhamGop,
  type TrangThai,
} from "@/lib/muc-tieu-quy";
import { layLapDonQuy, loaiTruSanPhamQuy } from "./muc-tieu-actions";

type Loc = "tat-ca" | "chua-dat" | "cham" | "dat";
type LapDonState = { dang: boolean; loi?: string; pairs?: LapDonCap[]; ngoai?: LapDonNgoai[] };

const TONE_BAR: Record<TrangThai, string> = {
  dat: "bg-emerald-500",
  dung: "bg-sky-500",
  cham: "bg-amber-500",
  "nguy-co": "bg-red-500",
  "khong-dat": "bg-red-500",
};

function ThanhTienDo({ pct, pctThoiGian, trangThai }: { pct: number; pctThoiGian: number; trangThai: TrangThai }) {
  const w = Math.max(0, Math.min(100, pct * 100));
  return (
    <div className="flex min-w-[130px] items-center gap-2">
      <div className="relative h-2 flex-1 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${TONE_BAR[trangThai]}`} style={{ width: `${w}%` }} />
        <div
          className="absolute -top-0.5 h-3 w-px bg-slate-500/70"
          style={{ left: `${Math.max(0, Math.min(100, pctThoiGian * 100))}%` }}
          title={`Đã qua ${(pctThoiGian * 100).toFixed(0)}% thời gian`}
        />
      </div>
      <span className="w-14 text-right text-xs font-medium tabular-nums text-slate-700">{fmtPct(pct)}</span>
    </div>
  );
}

function TrangThaiBadge({ t, daKetThuc }: { t: TrangThai; daKetThuc: boolean }) {
  const { nhan, tone } = NHAN_TRANG_THAI[t];
  return <Badge tone={tone}>{t === "dat" && daKetThuc ? "Đạt" : nhan}</Badge>;
}

function TrangThaiCap({ th, mt }: { th: number; mt: number }) {
  if (th <= 0) return <Badge tone="danger">Chưa lặp</Badge>;
  if (th < mt) return <Badge tone="warning">Đang lặp, chưa đủ</Badge>;
  if (th === mt) return <Badge tone="success">Đạt</Badge>;
  return <Badge tone="brand">Vượt</Badge>;
}

export default function MucTieuBang({
  nam,
  quy,
  ssView,
  laAsm,
  nhap,
  pctThoiGian,
  daKetThuc,
  nhanKy,
  nhanTruoc,
  co,
  moi,
  loaiTru,
  ssNames,
}: {
  nam: number;
  quy: number;
  ssView: string | null;
  laAsm: boolean;
  nhap: boolean;
  pctThoiGian: number;
  daKetThuc: boolean;
  nhanKy: string;
  nhanTruoc: string;
  co: SanPhamGop[];
  moi: SanPhamGop[];
  loaiTru: SanPhamGop[];
  ssNames: Record<string, string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loc, setLoc] = useState<Loc>("tat-ca");
  const [tim, setTim] = useState("");
  const [mo, setMo] = useState<Set<string>>(new Set());
  const [lapDon, setLapDon] = useState<Record<string, LapDonState>>({});
  const [loaiTruMo, setLoaiTruMo] = useState<string | null>(null);
  const [ghiChu, setGhiChu] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [chiChuaLap, setChiChuaLap] = useState(false);

  const canEdit = laAsm && nhap;

  const dong = useMemo(() => {
    const q = tim.trim().toLowerCase();
    return co
      .map((p) => {
        const pct = p.muc_tieu > 0 ? p.th_ky_nay / p.muc_tieu : 0;
        return { p, pct, tt: tinhTrangThai(pct, pctThoiGian, daKetThuc) };
      })
      .filter(({ p, pct, tt }) => {
        if (q && !p.ten.toLowerCase().includes(q) && !p.ma_chuan.toLowerCase().includes(q)) return false;
        if (loc === "chua-dat") return pct < 1;
        if (loc === "cham") return tt === "cham" || tt === "nguy-co" || tt === "khong-dat";
        if (loc === "dat") return pct >= 1;
        return true;
      });
  }, [co, tim, loc, pctThoiGian, daKetThuc]);

  function toggle(p: SanPhamGop) {
    const next = new Set(mo);
    if (next.has(p.ma_chuan)) {
      next.delete(p.ma_chuan);
      setMo(next);
      return;
    }
    next.add(p.ma_chuan);
    setMo(next);
    if (!lapDon[p.ma_chuan]) {
      setLapDon((s) => ({ ...s, [p.ma_chuan]: { dang: true } }));
      layLapDonQuy({ nam, quy, maChuan: p.ma_chuan, ss: ssView }).then((res) => {
        setLapDon((s) => ({
          ...s,
          [p.ma_chuan]: res.error ? { dang: false, loi: res.error } : { dang: false, pairs: res.pairs, ngoai: res.ngoai },
        }));
      });
    }
  }

  function datLoaiTru(maChuan: string, giaTri: boolean) {
    setLoi(null);
    startTransition(async () => {
      const res = await loaiTruSanPhamQuy({ nam, quy, maChuan, loaiTru: giaTri, ghiChu: giaTri ? ghiChu : "" });
      if (res.error) {
        setLoi(res.error);
        return;
      }
      setLoaiTruMo(null);
      setGhiChu("");
      router.refresh();
    });
  }

  const chip = (value: Loc, nhan: string) => (
    <button
      key={value}
      onClick={() => setLoc(value)}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        loc === value ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {nhan}
    </button>
  );

  const soCot = 8;

  return (
    <div className="space-y-5">
      <Card padding="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          {chip("tat-ca", `Tất cả (${co.length})`)}
          {chip("chua-dat", "Chưa đạt")}
          {chip("cham", "Chậm / nguy cơ")}
          {chip("dat", "Đã đạt")}
          <input
            value={tim}
            onChange={(e) => setTim(e.target.value)}
            placeholder="Tìm sản phẩm..."
            className="ml-auto w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:w-60"
          />
        </div>
        {loi && <p className="m-4 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{loi}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="bg-slate-50/70 text-left text-xs font-semibold text-slate-500">
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5">Sản phẩm</th>
                <th className="px-3 py-2.5 text-right">TH {nhanTruoc}</th>
                <th className="px-3 py-2.5 text-right">Mục tiêu {nhanKy}</th>
                <th className="px-3 py-2.5 text-right">TH {nhanKy}</th>
                <th className="px-3 py-2.5">% đạt</th>
                <th className="px-3 py-2.5 text-right">Còn lại</th>
                <th className="px-3 py-2.5">Trạng thái</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {dong.length === 0 && (
                <tr>
                  <td colSpan={soCot} className="p-6">
                    <EmptyState>Không có sản phẩm nào khớp bộ lọc.</EmptyState>
                  </td>
                </tr>
              )}
              {dong.map(({ p, pct, tt }) => {
                const dangMo = mo.has(p.ma_chuan);
                const st = lapDon[p.ma_chuan];
                return (
                  <Fragment key={p.ma_chuan}>
                    <tr
                      onClick={() => toggle(p)}
                      className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                    >
                      <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                        <div className="flex items-start gap-2">
                          <span className={`mt-0.5 text-slate-400 transition-transform ${dangMo ? "rotate-90" : ""}`}>▶</span>
                          <div>
                            <p className="font-medium text-slate-900">{p.ten}</p>
                            <p className="text-xs text-slate-400">{p.ma_chuan}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtSo(p.th_ky_truoc)}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">{fmtSo(p.muc_tieu)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtSo(p.th_ky_nay)}</td>
                      <td className="px-3 py-2.5">
                        <ThanhTienDo pct={pct} pctThoiGian={pctThoiGian} trangThai={tt} />
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {fmtSo(Math.max(0, p.muc_tieu - p.th_ky_nay))}
                      </td>
                      <td className="px-3 py-2.5">
                        <TrangThaiBadge t={tt} daKetThuc={daKetThuc} />
                      </td>
                      <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <button
                            onClick={() => {
                              setLoaiTruMo(loaiTruMo === p.ma_chuan ? null : p.ma_chuan);
                              setGhiChu("");
                            }}
                            className="text-xs text-slate-400 hover:text-red-600"
                          >
                            Loại trừ
                          </button>
                        )}
                      </td>
                    </tr>

                    {canEdit && loaiTruMo === p.ma_chuan && (
                      <tr className="bg-red-50/40">
                        <td colSpan={soCot} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-slate-600">Loại {p.ten} khỏi mục tiêu {nhanKy}. Lý do (không bắt buộc):</span>
                            <input
                              value={ghiChu}
                              onChange={(e) => setGhiChu(e.target.value)}
                              className="w-64 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-500"
                            />
                            <button
                              disabled={isPending}
                              onClick={() => datLoaiTru(p.ma_chuan, true)}
                              className="rounded-lg bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Xác nhận loại trừ
                            </button>
                            <button onClick={() => setLoaiTruMo(null)} className="text-xs text-slate-500 underline">
                              Hủy
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {dangMo && (
                      <tr className="bg-slate-50/40">
                        <td colSpan={soCot} className="px-4 py-4">
                          <ChiTiet
                            p={p}
                            ssView={ssView}
                            st={st}
                            nhanKy={nhanKy}
                            nhanTruoc={nhanTruoc}
                            pctThoiGian={pctThoiGian}
                            daKetThuc={daKetThuc}
                            ssNames={ssNames}
                            chiChuaLap={chiChuaLap}
                            setChiChuaLap={setChiChuaLap}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {moi.length > 0 && (
        <details className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
            Sản phẩm mới - không áp dụng mục tiêu ({moi.length})
            <span className="ml-2 text-xs font-normal text-slate-500">Quý trước không có số liệu nên không đặt mục tiêu</span>
          </summary>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500">
                <th className="py-1.5">Sản phẩm</th>
                <th className="py-1.5">SS</th>
                <th className="py-1.5 text-right">TH {nhanKy}</th>
              </tr>
            </thead>
            <tbody>
              {moi.flatMap((p) =>
                p.ssMoi.map((r) => (
                  <tr key={`${p.ma_chuan}-${r.ma_ss}`} className="border-t border-slate-100">
                    <td className="py-1.5">
                      {p.ten} <span className="text-xs text-slate-400">{p.ma_chuan}</span>
                    </td>
                    <td className="py-1.5 text-slate-600">{ssNames[r.ma_ss] ?? r.ma_ss}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtSo(r.th_ky_nay)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </details>
      )}

      {loaiTru.length > 0 && (
        <details className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
            Sản phẩm đã loại trừ ({loaiTru.length})
          </summary>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {loaiTru.map((p) => (
                <tr key={p.ma_chuan} className="border-t border-slate-100">
                  <td className="py-1.5">
                    {p.ten} <span className="text-xs text-slate-400">{p.ma_chuan}</span>
                  </td>
                  <td className="py-1.5 text-xs text-slate-500">{p.ghi_chu ?? "Không ghi lý do"}</td>
                  <td className="py-1.5 text-right">
                    {canEdit && (
                      <button
                        disabled={isPending}
                        onClick={() => datLoaiTru(p.ma_chuan, false)}
                        className="text-xs text-blue-700 underline disabled:opacity-50"
                      >
                        Khôi phục
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

function ChiTiet({
  p,
  ssView,
  st,
  nhanKy,
  nhanTruoc,
  pctThoiGian,
  daKetThuc,
  ssNames,
  chiChuaLap,
  setChiChuaLap,
}: {
  p: SanPhamGop;
  ssView: string | null;
  st: LapDonState | undefined;
  nhanKy: string;
  nhanTruoc: string;
  pctThoiGian: number;
  daKetThuc: boolean;
  ssNames: Record<string, string>;
  chiChuaLap: boolean;
  setChiChuaLap: (v: boolean) => void;
}) {
  const nhieuSs = !ssView && p.theoSs.length > 1;
  const pairs = st?.pairs ?? [];
  const ngoai = st?.ngoai ?? [];
  const tongMtLap = pairs.reduce((s, r) => s + r.muc_tieu, 0);
  const tongThLap = pairs.reduce((s, r) => s + r.th_ky_nay, 0);
  const tongNgoai = ngoai.reduce((s, r) => s + r.th_ky_nay, 0);
  const chuaLap = pairs.filter((r) => r.th_ky_nay <= 0).length;
  const hienThi = chiChuaLap ? pairs.filter((r) => r.th_ky_nay < r.muc_tieu) : pairs;

  return (
    <div className="space-y-5">
      {nhieuSs && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Theo SS</p>
          <table className="w-full max-w-3xl text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500">
                <th className="py-1">SS</th>
                <th className="py-1 text-right">TH {nhanTruoc}</th>
                <th className="py-1 text-right">Mục tiêu</th>
                <th className="py-1 text-right">TH {nhanKy}</th>
                <th className="py-1 pl-4">% đạt</th>
                <th className="py-1 text-right">Còn lại</th>
                <th className="py-1 pl-4">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {p.theoSs.map((r) => {
                const mt = r.muc_tieu ?? 0;
                const pct = mt > 0 ? r.th_ky_nay / mt : 0;
                const tt = tinhTrangThai(pct, pctThoiGian, daKetThuc);
                return (
                  <tr key={r.ma_ss} className="border-t border-slate-100">
                    <td className="py-1.5">{ssNames[r.ma_ss] ?? r.ma_ss}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtSo(r.th_ky_truoc)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtSo(mt)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtSo(r.th_ky_nay)}</td>
                    <td className="py-1.5 pl-4">
                      <ThanhTienDo pct={pct} pctThoiGian={pctThoiGian} trangThai={tt} />
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{fmtSo(Math.max(0, mt - r.th_ky_nay))}</td>
                    <td className="py-1.5 pl-4">
                      <TrangThaiBadge t={tt} daKetThuc={daKetThuc} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {p.ssMoi.length > 0 && (
        <p className="text-xs text-amber-700">
          Có {p.ssMoi.map((r) => `${ssNames[r.ma_ss] ?? r.ma_ss} (${fmtSo(r.th_ky_nay)})`).join(", ")} bán sản phẩm này nhưng {nhanTruoc} không có
          số liệu nên không có mục tiêu, và không tính vào số trên.
        </p>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Khách lặp đơn (đã mua {nhanTruoc})
          </p>
          {st?.pairs && (
            <span className="text-xs text-slate-500">
              {pairs.length} khách · chưa lặp {chuaLap}
            </span>
          )}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={chiChuaLap} onChange={(e) => setChiChuaLap(e.target.checked)} />
            Chỉ khách chưa đủ
          </label>
        </div>

        {st?.dang && <p className="text-sm text-slate-500">Đang tải danh sách khách...</p>}
        {st?.loi && <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{st.loi}</p>}

        {st?.pairs && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500">
                  <th className="py-1.5">Khách</th>
                  <th className="py-1.5">NV</th>
                  <th className="py-1.5 text-right">SL {nhanTruoc} (đơn / tháng)</th>
                  <th className="py-1.5 text-right">Mục tiêu</th>
                  <th className="py-1.5 text-right">TH {nhanKy}</th>
                  <th className="py-1.5 pl-4">% đạt</th>
                  <th className="py-1.5 text-right">Còn lại</th>
                  <th className="py-1.5 pl-4">Mua gần nhất</th>
                  <th className="py-1.5 pl-4">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {hienThi.map((r) => {
                  const pct = r.muc_tieu > 0 ? r.th_ky_nay / r.muc_tieu : 0;
                  const tt = tinhTrangThai(pct, pctThoiGian, daKetThuc);
                  const doiSs = r.ss_hien_tai && r.ss_hien_tai !== r.ma_ss;
                  return (
                    <tr key={`${r.ma_ss}-${r.ma_khach}`} className="border-t border-slate-100">
                      <td className="py-1.5">
                        <p className="font-medium text-slate-800">{r.ten_khach ?? r.ma_khach}</p>
                        <p className="text-xs text-slate-400">
                          {r.ma_khach}
                          {!ssView ? ` · ${ssNames[r.ma_ss] ?? r.ma_ss}` : ""}
                        </p>
                      </td>
                      <td className="py-1.5 text-slate-700">{r.ten_nhan_vien ?? r.ma_nhan_vien ?? "—"}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {fmtSo(r.sl_ky_truoc)}{" "}
                        <span className="text-xs text-slate-400">
                          ({r.so_don} đơn / {r.so_thang} tháng)
                        </span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{fmtSo(r.muc_tieu)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtSo(r.th_ky_nay)}</td>
                      <td className="py-1.5 pl-4">
                        <ThanhTienDo pct={pct} pctThoiGian={pctThoiGian} trangThai={tt} />
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{fmtSo(Math.max(0, r.muc_tieu - r.th_ky_nay))}</td>
                      <td className="py-1.5 pl-4 text-slate-600">{fmtNgay(r.ngay_gan_nhat)}</td>
                      <td className="py-1.5 pl-4">
                        <div className="flex flex-wrap items-center gap-1">
                          <TrangThaiCap th={r.th_ky_nay} mt={r.muc_tieu} />
                          {doiSs && (
                            <Badge tone="neutral">SS hiện tại: {ssNames[r.ss_hien_tai ?? ""] ?? r.ss_hien_tai}</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {hienThi.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-sm text-slate-400">
                      Không có khách nào.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 text-sm font-semibold text-slate-800">
                  <td className="py-2" colSpan={3}>
                    Σ mục tiêu lặp đơn
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmtSo(tongMtLap)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtSo(tongThLap)}</td>
                  <td colSpan={4} />
                </tr>
                <tr className="text-sm text-slate-700">
                  <td className="py-1.5" colSpan={3}>
                    Chênh lệch cần khách mới / tăng lượng
                    <span className="ml-1 text-xs text-slate-400">(mục tiêu sản phẩm − Σ mục tiêu lặp đơn)</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{fmtSo(Math.max(0, p.muc_tieu - tongMtLap))}</td>
                  <td colSpan={5} />
                </tr>
                <tr className="text-sm text-slate-700">
                  <td className="py-1.5" colSpan={3}>
                    Khách mới / ngoài {nhanTruoc} ({ngoai.length} khách)
                  </td>
                  <td />
                  <td className="py-1.5 text-right tabular-nums">{fmtSo(tongNgoai)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
            {ngoai.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-xs text-slate-500">Xem khách mới / ngoài {nhanTruoc}</summary>
                <ul className="mt-1.5 space-y-0.5 text-slate-700">
                  {ngoai.map((r) => (
                    <li key={`${r.ma_ss}-${r.ma_khach}`}>
                      {r.ten_khach ?? r.ma_khach} <span className="text-xs text-slate-400">({r.ma_khach})</span> · {fmtSo(r.th_ky_nay)}
                      {!ssView && <span className="text-xs text-slate-400"> · {ssNames[r.ma_ss] ?? r.ma_ss}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
