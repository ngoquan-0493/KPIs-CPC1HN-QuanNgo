"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { nhanQuy, fmtNgay, type CauHinhQuy } from "@/lib/muc-tieu-quy";
import { taoNhapMucTieuQuy, capNhatTyLeMucTieuQuy, chotMucTieuQuy } from "./muc-tieu-actions";

type Ky = { nam: number; quy: number; trang_thai: "nhap" | "chot" };

// Thanh dieu khien tab "Muc tieu quy": chon ky, tao ban nhap, chinh ty le tang, chot.
// Chi ASM thay cac nut ghi; moi thao tac nguy hiem (tao lai, chot) can bam 2 lan de xac nhan.
export default function MucTieuDieuKhien({
  kyList,
  chon,
  laAsm,
  cfg,
  quyNow,
  coQuyNow,
}: {
  kyList: Ky[];
  chon: { nam: number; quy: number } | null;
  laAsm: boolean;
  cfg: CauHinhQuy | null;
  quyNow: { nam: number; quy: number };
  coQuyNow: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [loi, setLoi] = useState<string | null>(null);
  const [xacNhan, setXacNhan] = useState<"tao" | "chot" | null>(null);
  const [tyLe, setTyLe] = useState<string>(String(cfg?.ty_le_tang ?? 10));

  function doiKy(value: string) {
    const [nam, quy] = value.split("-");
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "muc-tieu");
    params.set("nam", nam);
    params.set("quy", quy);
    router.push(`${pathname}?${params.toString()}`);
  }

  function chay(fn: () => Promise<{ error?: string }>) {
    setLoi(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) {
        setLoi(res.error);
        return;
      }
      setXacNhan(null);
      router.refresh();
    });
  }

  const nhap = cfg?.trang_thai === "nhap";
  const btn =
    "rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <Card className="mb-5" padding="p-4">
      <div className="flex flex-wrap items-center gap-3">
        {kyList.length > 0 && chon && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Kỳ
            <select
              value={`${chon.nam}-${chon.quy}`}
              onChange={(e) => doiKy(e.target.value)}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {kyList.map((k) => (
                <option key={`${k.nam}-${k.quy}`} value={`${k.nam}-${k.quy}`}>
                  {nhanQuy(k.nam, k.quy)}
                  {k.trang_thai === "nhap" ? " (nháp)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        {cfg && (
          <Badge tone={nhap ? "warning" : "success"}>{nhap ? "Bản nháp - chưa chốt" : "Đã chốt"}</Badge>
        )}
        {cfg && !nhap && cfg.chot_luc && (
          <span className="text-xs text-slate-500">Chốt lúc {fmtNgay(cfg.chot_luc)}</span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {laAsm && !coQuyNow && (
            <button
              disabled={isPending}
              onClick={() => chay(() => taoNhapMucTieuQuy({ nam: quyNow.nam, quy: quyNow.quy, tyLe: 10 }))}
              className={`${btn} bg-blue-700 text-white hover:bg-blue-800`}
            >
              {isPending ? "Đang tạo..." : `Tạo mục tiêu ${nhanQuy(quyNow.nam, quyNow.quy)}`}
            </button>
          )}

          {laAsm && cfg && nhap && (
            <>
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                Tăng tối thiểu
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={tyLe}
                  onChange={(e) => setTyLe(e.target.value)}
                  className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                %
              </label>
              <button
                disabled={isPending || tyLe.trim() === "" || Number(tyLe) === cfg.ty_le_tang || Number(tyLe) < 0}
                onClick={() => chay(() => capNhatTyLeMucTieuQuy({ nam: cfg.nam, quy: cfg.quy, tyLe: Number(tyLe) }))}
                className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
              >
                Áp dụng
              </button>
              <button
                disabled={isPending}
                onClick={() =>
                  xacNhan === "tao"
                    ? chay(() => taoNhapMucTieuQuy({ nam: cfg.nam, quy: cfg.quy, tyLe: Number(tyLe) || 10 }))
                    : setXacNhan("tao")
                }
                className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
              >
                {xacNhan === "tao" ? "Bấm lần nữa: tạo lại (mất loại trừ)" : "Tạo lại bản nháp"}
              </button>
              <button
                disabled={isPending}
                onClick={() =>
                  xacNhan === "chot" ? chay(() => chotMucTieuQuy({ nam: cfg.nam, quy: cfg.quy })) : setXacNhan("chot")
                }
                className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
              >
                {xacNhan === "chot" ? "Bấm lần nữa để chốt" : "Chốt mục tiêu"}
              </button>
              {xacNhan && (
                <button onClick={() => setXacNhan(null)} className="text-xs text-slate-500 underline">
                  Hủy
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {loi && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{loi}</p>}
      {cfg && nhap && (
        <p className="mt-3 text-xs text-slate-500">
          Bản nháp: bạn có thể loại trừ sản phẩm, kiểm tra số liệu và đổi tỷ lệ tăng. Sau khi chốt, mục tiêu được khóa và
          không đổi theo dữ liệu lịch sử nữa.
        </p>
      )}
    </Card>
  );
}
