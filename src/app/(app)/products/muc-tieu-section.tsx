import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProductsTabs from "@/components/products-tabs";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { IconAlert, IconCheck, IconUsers, IconWallet } from "@/components/icons";
import type { Employee } from "@/lib/current-employee";
import {
  gopTheoSanPham,
  nhanQuy,
  normCode,
  quyHienTai,
  tinhTrangThai,
  type DongSs,
  type MucTieuQuy,
} from "@/lib/muc-tieu-quy";
import MucTieuBang from "./muc-tieu-bang";
import MucTieuDieuKhien from "./muc-tieu-dieu-khien";

type KyRow = { nam: number; quy: number; trang_thai: "nhap" | "chot" };

// Tab "Muc tieu quy" cua trang /products (server component). Thiet ke + quy tac: project doc
// "claude/thiet-ke-muc-tieu-quy-san-pham.md". Du lieu lay tu RPC get_muc_tieu_quy (da kiem quyen trong Postgres:
// ASM xem du 4 SS, SS chi thay SS cua minh).
export default async function MucTieuQuySection({
  sp,
  employee,
}: {
  sp: { nam?: string; quy?: string; ss?: string };
  employee: Employee;
}) {
  const laAsm = employee["Vị trí"] === "ASM";
  const maCuaToi = employee["Mã nhân viên"];
  const supabase = await createClient();
  const now = quyHienTai();

  const kyRes = await supabase
    .from("chi_tieu_quy_cau_hinh")
    .select("nam,quy,trang_thai")
    .order("nam", { ascending: false })
    .order("quy", { ascending: false });
  const kyList = (kyRes.data ?? []) as KyRow[];

  const yeuCauNam = Number(sp.nam);
  const yeuCauQuy = Number(sp.quy);
  const chonKy =
    kyList.find((k) => k.nam === yeuCauNam && k.quy === yeuCauQuy) ??
    kyList.find((k) => k.nam === now.nam && k.quy === now.quy) ??
    kyList[0] ??
    null;
  const coQuyNow = kyList.some((k) => k.nam === now.nam && k.quy === now.quy);

  // SS dang xem: ASM chon qua ?ss= (mac dinh tat ca), SS chi xem SS cua minh.
  const ssView = laAsm ? (sp.ss ? sp.ss : null) : maCuaToi;

  let data: MucTieuQuy | null = null;
  let metaScoped: MucTieuQuy["meta"] | undefined;
  let loiTai: string | null = null;
  if (chonKy) {
    const [full, scoped] = await Promise.all([
      supabase.rpc("get_muc_tieu_quy", { p_nam: chonKy.nam, p_quy: chonKy.quy, p_ss: null }),
      laAsm && ssView
        ? supabase.rpc("get_muc_tieu_quy", { p_nam: chonKy.nam, p_quy: chonKy.quy, p_ss: ssView })
        : Promise.resolve(null),
    ]);
    if (full.error) loiTai = full.error.message;
    data = (full.data ?? null) as MucTieuQuy | null;
    metaScoped = scoped && !scoped.error ? ((scoped.data as MucTieuQuy | null)?.meta ?? undefined) : data?.meta;
  }

  const cfg = data?.cau_hinh ?? null;
  const meta = data?.meta;
  const rows: DongSs[] = data?.rows ?? [];

  const ssNames: Record<string, string> = {};
  for (const r of rows) if (r.ten_ss) ssNames[r.ma_ss] = r.ten_ss;
  const dsSs = Object.entries(ssNames).sort((a, b) => a[1].localeCompare(b[1]));

  const { co, moi, loaiTru } = gopTheoSanPham(rows, ssView);

  const nhanKy = cfg ? nhanQuy(cfg.nam, cfg.quy) : "";
  const goc = cfg ? { nam: cfg.quy_goc_nam, quy: cfg.quy_goc } : null;
  const nhanTruoc = goc ? nhanQuy(goc.nam, goc.quy) : "";

  const pctThoiGian = meta?.pct_thoi_gian ?? 0;
  const daKetThuc = meta?.da_ket_thuc ?? false;
  const trangThai = co.map((p) => tinhTrangThai(p.muc_tieu > 0 ? p.th_ky_nay / p.muc_tieu : 0, pctThoiGian, daKetThuc));
  const soDat = trangThai.filter((t) => t === "dat").length;
  const soCham = trangThai.filter((t) => t === "cham" || t === "nguy-co" || t === "khong-dat").length;

  const href = (ss: string | null) => {
    const p = new URLSearchParams({ tab: "muc-tieu" });
    if (chonKy) {
      p.set("nam", String(chonKy.nam));
      p.set("quy", String(chonKy.quy));
    }
    if (ss) p.set("ss", ss);
    return `/products?${p.toString()}`;
  };

  const moTa = cfg
    ? `${nhanKy} so với ${nhanTruoc} · tăng tối thiểu ${cfg.ty_le_tang}% · ${
        daKetThuc ? "quý đã kết thúc" : `đã qua ${Math.round(pctThoiGian * 100)}% thời gian`
      }${ssView ? ` · Nhóm ${ssNames[ssView] ?? ssView}` : " · Toàn ASM"}`
    : "Theo dõi sản lượng từng sản phẩm so với quý trước";

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <PageHeader title="Sản phẩm" description={moTa} />
      <ProductsTabs />

      <MucTieuDieuKhien
        kyList={kyList}
        chon={chonKy ? { nam: chonKy.nam, quy: chonKy.quy } : null}
        laAsm={laAsm}
        cfg={cfg}
        quyNow={now}
        coQuyNow={coQuyNow}
      />

      {loiTai && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Lỗi tải mục tiêu quý: {loiTai}</p>}

      {!chonKy && (
        <Card>
          <EmptyState>
            Chưa có mục tiêu quý nào.{" "}
            {laAsm
              ? `Bấm "Tạo mục tiêu ${nhanQuy(now.nam, now.quy)}" để tạo bản nháp.`
              : "ASM sẽ tạo mục tiêu quý và chốt trước khi bạn xem được ở đây."}
          </EmptyState>
        </Card>
      )}

      {cfg && (
        <>
          {laAsm && dsSs.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              <Link
                href={href(null)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  !ssView ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tất cả ASM
              </Link>
              {dsSs.map(([ma, ten]) => (
                <Link
                  key={ma}
                  href={href(ma)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    ssView && normCode(ssView) === normCode(ma)
                      ? "bg-blue-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {ten}
                </Link>
              ))}
            </div>
          )}

          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Sản phẩm đạt mục tiêu"
              value={`${soDat} / ${co.length}`}
              icon={<IconCheck />}
              tone="success"
              hint={daKetThuc ? "Kết quả cuối quý" : "Đã đạt 100% mục tiêu quý"}
            />
            <StatCard
              label={daKetThuc ? "Sản phẩm không đạt" : "Chậm / nguy cơ"}
              value={String(soCham)}
              icon={<IconAlert />}
              tone="warning"
              hint="% đạt thấp hơn % thời gian đã qua từ 10 điểm"
            />
            <StatCard
              label="Cặp khách–sản phẩm chưa lặp đơn"
              value={`${metaScoped?.cap_chua_lap ?? 0} / ${metaScoped?.tong_cap ?? 0}`}
              icon={<IconUsers />}
              tone="info"
              hint={`Đã mua ${nhanTruoc}, chưa có đơn ${nhanKy}`}
            />
            <StatCard
              label="Sản phẩm mới - không áp dụng"
              value={String(moi.length)}
              icon={<IconWallet />}
              tone="brand"
              hint={`Không có số liệu ${nhanTruoc}`}
            />
          </div>

          <MucTieuBang
            key={`${cfg.nam}-${cfg.quy}-${ssView ?? "all"}-${cfg.ty_le_tang}-${co.length}-${loaiTru.length}`}
            nam={cfg.nam}
            quy={cfg.quy}
            ssView={ssView}
            laAsm={laAsm}
            nhap={cfg.trang_thai === "nhap"}
            pctThoiGian={pctThoiGian}
            daKetThuc={daKetThuc}
            nhanKy={nhanKy}
            nhanTruoc={nhanTruoc}
            co={co}
            moi={moi}
            loaiTru={loaiTru}
            ssNames={ssNames}
          />
        </>
      )}
    </div>
  );
}
