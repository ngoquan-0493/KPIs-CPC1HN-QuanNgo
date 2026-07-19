import { createClient } from "@/lib/supabase/server";
import {
  DeXuatCard,
  ThemViecMoiForm,
  DuyetWeeklyReviewButton,
  XacNhanKetQuaCard,
} from "@/components/ai-review-actions";
import SsFilter from "@/components/ss-filter";
import { ghepTenMa } from "@/lib/display";
import { Card, PageHeader, SectionHeading, EmptyState, Badge } from "@/components/ui";

type WeeklyReview = {
  id: number;
  tuan_bat_dau: string;
  cap_do_danh_gia: string | null;
  ma_ss: string | null;
  ma_nhan_vien: string | null;
  tinh_trang_chung: string | null;
  diem_hieu_qua: number | null;
  do_tin_cay_ai: number | null;
  rui_ro: { mo_ta: string; muc_do: string; bang_chung: string }[] | null;
  hanh_dong_de_xuat: { hanh_dong: string; ly_do: string; uu_tien: string }[] | null;
  trang_thai_duyet: string | null;
};

type Feedback = {
  id: number;
  review_id: number | null;
  ma_nhan_vien_thuc_hien: string;
  ma_ss: string | null;
  kenh: string | null;
  nhom_khach_hang: string | null;
  san_pham: string | null;
  ket_qua_du_kien: string | null;
  hanh_dong_goc: string | null;
  quyet_dinh_quan_ly: string | null;
  trang_thai_thuc_hien: string | null;
  thanh_cong: boolean | null;
  tuan_bat_dau: string | null;
  created_at: string;
};

type TaskLienKet = { nguon_phan_hoi_ai_id: number; han_hoan_thanh: string | null };

type EmployeeRow = { "Mã nhân viên": string; "Tên nhân viên": string | null; SS: string | null };

// 3 trang thai chuan cua phan_hoi_hoc_tu_ai (xac nhan voi ASM, khong doi
// schema): cho_tao_cong_viec/null = cho duyet; da_tao_task/approved = da
// duyet va da sinh viec that; tieu_chi_can_dieu_chinh/<ly do tu do> = da
// bo/dieu chinh.
const TRANG_THAI_CHO_DUYET = "cho_tao_cong_viec";
const TRANG_THAI_DA_DUYET = "da_tao_task";
const TRANG_THAI_DIEU_CHINH = "tieu_chi_can_dieu_chinh";

function weekBoundsForDisplay(): { start: string; end: string } {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

function scoreTone(diem: number | null): "neutral" | "success" | "warning" | "danger" {
  if (diem == null) return "neutral";
  if (diem >= 70) return "success";
  if (diem >= 40) return "warning";
  return "danger";
}

function priorityTone(uuTien: string): "danger" | "warning" | "neutral" {
  if (uuTien === "cao" || uuTien === "khan") return "danger";
  if (uuTien === "trung_binh" || uuTien === "vua" || uuTien === "uu_tien") return "warning";
  return "neutral";
}

function tinhTrangTone(tinhTrang: string): "danger" | "warning" | "success" | "neutral" {
  const t = tinhTrang.toLowerCase();
  if (t.includes("can can thiep") || t.includes("báo động") || t.includes("bao dong")) return "danger";
  if (t.includes("can theo doi") || t.includes("cần theo dõi") || t.includes("chậm")) return "warning";
  if (t.includes("tot") || t.includes("tốt") || t.includes("on dinh") || t.includes("ổn định"))
    return "success";
  return "neutral";
}

export default async function AiReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ ss?: string }>;
}) {
  const supabase = await createClient();
  const { ss: selectedSs } = await searchParams;

  const [reviewsRes, feedbackRes, empRes] = await Promise.all([
    supabase
      .from("nhan_dinh_ai_tuan")
      .select(
        "id,tuan_bat_dau,cap_do_danh_gia,ma_ss,ma_nhan_vien,tinh_trang_chung,diem_hieu_qua,do_tin_cay_ai,rui_ro,hanh_dong_de_xuat,trang_thai_duyet",
      )
      .order("tuan_bat_dau", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
    supabase
      .from("phan_hoi_hoc_tu_ai")
      .select(
        "id,review_id,ma_nhan_vien_thuc_hien,ma_ss,kenh,nhom_khach_hang,san_pham,ket_qua_du_kien,hanh_dong_goc,quyet_dinh_quan_ly,trang_thai_thuc_hien,thanh_cong,tuan_bat_dau,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("Danh sach nhan vien")
      .select('"Mã nhân viên":ma_nhan_vien,"Tên nhân viên":ten_nhan_vien,SS:ss'),
  ]);

  const nameByCode = new Map<string, string>();
  const employeeSsMap = new Map<string, string | null>();
  const employeeList: { code: string; name: string }[] = [];
  for (const e of (empRes.data ?? []) as EmployeeRow[]) {
    const name = e["Tên nhân viên"] ?? e["Mã nhân viên"];
    nameByCode.set(e["Mã nhân viên"], name);
    employeeSsMap.set(e["Mã nhân viên"], e.SS);
    employeeList.push({ code: e["Mã nhân viên"], name });
  }
  employeeList.sort((a, b) => a.name.localeCompare(b.name));
  // nameByCode gom ca NV lan SS (query khong loc vi_tri) nen dung chung 1 ham
  // ghep Ten (Ma) cho ca hai loai ma, thay vi hien rieng le ten hoac ma.
  const tenTheoMa = (ma: string | null | undefined) => ghepTenMa(nameByCode.get(ma ?? ""), ma);
  const ssList = Array.from(
    new Set(Array.from(employeeSsMap.values()).filter((v): v is string => !!v)),
  ).sort((a, b) => a.localeCompare(b));
  const { start: currentWeekStart, end: currentWeekEnd } = weekBoundsForDisplay();

  const allReviews = (reviewsRes.data ?? []) as WeeklyReview[];
  const latestWeek = allReviews[0]?.tuan_bat_dau;
  const thisWeek = allReviews.filter((r) => r.tuan_bat_dau === latestWeek);

  // Cap nhom SS (danh gia tong quan ca nhom) - moi ma_ss chi lay 1 dong moi nhat
  const seenGroup = new Set<string>();
  let reviews = thisWeek.filter((r) => {
    if (r.cap_do_danh_gia !== "ss" || r.ma_nhan_vien) return false;
    const key = r.ma_ss ?? String(r.id);
    if (seenGroup.has(key)) return false;
    seenGroup.add(key);
    return true;
  });
  if (selectedSs) {
    reviews = reviews.filter((r) => nameByCode.get(r.ma_ss ?? "") === selectedSs);
  }

  // Cap ca nhan (de xuat rieng cho tung nhan vien) - moi ma_nhan_vien chi lay 1 dong moi nhat
  const seenNv = new Set<string>();
  let individualReviews = thisWeek.filter((r) => {
    if (r.cap_do_danh_gia !== "nhan_vien" || !r.ma_nhan_vien) return false;
    if (seenNv.has(r.ma_nhan_vien)) return false;
    seenNv.add(r.ma_nhan_vien);
    return true;
  });
  if (selectedSs) {
    individualReviews = individualReviews.filter(
      (r) => nameByCode.get(r.ma_ss ?? "") === selectedSs,
    );
  }
  const individualByGroup = new Map<string, WeeklyReview[]>();
  for (const r of individualReviews) {
    const key = r.ma_ss ?? "khac";
    if (!individualByGroup.has(key)) individualByGroup.set(key, []);
    individualByGroup.get(key)!.push(r);
  }

  const allFeedback = (
    selectedSs
      ? ((feedbackRes.data ?? []) as Feedback[]).filter(
          (f) => employeeSsMap.get(f.ma_nhan_vien_thuc_hien) === selectedSs,
        )
      : ((feedbackRes.data ?? []) as Feedback[])
  );
  const pending = allFeedback.filter(
    (f) => f.trang_thai_thuc_hien === TRANG_THAI_CHO_DUYET && !f.quyet_dinh_quan_ly,
  );
  // Da duyet (tao task that) nhung chua ai xac nhan ket qua thuc te - day la
  // mat xich con thieu cua vong lap hoc AI: neu khong xac nhan, cot
  // thanh_cong mai NULL va WF13a/WF13b khong bao gio co bang chung thanh cong
  // de cham diem toi da / rut bai hoc.
  const canXacNhan = allFeedback.filter(
    (f) => f.quyet_dinh_quan_ly === "approved" && f.thanh_cong === null,
  );

  const canXacNhanIds = canXacNhan.map((f) => f.id);
  const taskLienKetRes =
    canXacNhanIds.length > 0
      ? await supabase
          .from("ke_hoach_cong_viec_tuan")
          .select("nguon_phan_hoi_ai_id,han_hoan_thanh")
          .in("nguon_phan_hoi_ai_id", canXacNhanIds)
      : { data: [] as TaskLienKet[], error: null };
  const hanHoanThanhByFeedbackId = new Map<number, string | null>();
  for (const t of (taskLienKetRes.data ?? []) as TaskLienKet[]) {
    hanHoanThanhByFeedbackId.set(t.nguon_phan_hoi_ai_id, t.han_hoan_thanh);
  }

  const canXacNhanSet = new Set(canXacNhan.map((f) => f.id));
  const processed = allFeedback
    .filter((f) => !pending.includes(f) && !canXacNhanSet.has(f.id))
    .slice(0, 20);

  const error = reviewsRes.error ?? feedbackRes.error ?? empRes.error ?? taskLienKetRes.error;

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
      <PageHeader
        title="Đề xuất & Đánh giá AI"
        description="Duyệt đề xuất hành động sẽ tạo ngay công việc tuần cho nhân viên; bỏ/điều chỉnh cần nêu lý do để AI học lại. Xem thêm đánh giá AI hàng tuần theo nhóm SS bên dưới."
        actions={ssList.length > 0 && <SsFilter ssList={ssList} />}
      />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Lỗi tải dữ liệu: {error.message}
        </p>
      )}

      <section className="mb-8">
        <SectionHeading
          title="Đề xuất hành động đang chờ duyệt"
          count={pending.length}
          actions={
            <ThemViecMoiForm
              employees={employeeList}
              defaultWeekStart={currentWeekStart}
              defaultWeekEnd={currentWeekEnd}
            />
          }
        />
        {pending.length === 0 ? (
          <EmptyState>Không có đề xuất nào đang chờ.</EmptyState>
        ) : (
          <div className="space-y-2">
            {pending.map((f) => (
              <DeXuatCard
                key={f.id}
                feedback={f}
                employeeName={tenTheoMa(f.ma_nhan_vien_thuc_hien)}
                ssName={f.ma_ss ? tenTheoMa(f.ma_ss) : null}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <SectionHeading
          title="Đã duyệt — chờ xác nhận kết quả"
          count={canXacNhan.length}
          description="SS/ASM xác nhận đề xuất đã duyệt có thực sự thành công hay không — dùng để tính điểm hiệu quả và làm bằng chứng cho AI rút bài học dài hạn."
        />
        {canXacNhan.length === 0 ? (
          <EmptyState>Không có đề xuất nào cần xác nhận.</EmptyState>
        ) : (
          <div className="space-y-2">
            {canXacNhan.map((f) => (
              <XacNhanKetQuaCard
                key={f.id}
                feedback={f}
                employeeName={tenTheoMa(f.ma_nhan_vien_thuc_hien)}
                hanHoanThanh={hanHoanThanhByFeedbackId.get(f.id) ?? null}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <SectionHeading title={`Đánh giá AI tuần ${latestWeek ?? "—"} theo nhóm SS`} />
        {reviews.length === 0 ? (
          <EmptyState>Chưa có đánh giá AI tuần này.</EmptyState>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <Card key={r.id}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {r.ma_ss || r.ma_nhan_vien ? tenTheoMa(r.ma_ss ?? r.ma_nhan_vien) : "—"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Độ tin cậy AI:{" "}
                      {r.do_tin_cay_ai != null ? `${Math.round(r.do_tin_cay_ai * 100)}%` : "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={scoreTone(r.diem_hieu_qua)}>{r.diem_hieu_qua ?? "—"}/100</Badge>
                    {r.trang_thai_duyet === "approved" ? (
                      <Badge tone="brand">Đã duyệt</Badge>
                    ) : (
                      <DuyetWeeklyReviewButton id={r.id} />
                    )}
                  </div>
                </div>
                <p className="mb-2 text-sm text-slate-700">{r.tinh_trang_chung}</p>
                {r.hanh_dong_de_xuat && r.hanh_dong_de_xuat.length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs font-medium text-slate-500">Hành động đề xuất</p>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {r.hanh_dong_de_xuat.map((h, i) => (
                        <li key={i} className="rounded-lg bg-slate-50 p-2">
                          <span
                            className={`mr-2 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              priorityTone(h.uu_tien) === "danger"
                                ? "bg-red-100 text-red-700"
                                : priorityTone(h.uu_tien) === "warning"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {h.uu_tien}
                          </span>
                          {h.hanh_dong}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <SectionHeading
          title={`Đề xuất tuần ${latestWeek ?? "—"} theo từng nhân viên`}
          count={individualReviews.length}
        />
        {individualReviews.length === 0 ? (
          <EmptyState>Chưa có đề xuất cá nhân cho tuần này.</EmptyState>
        ) : (
          <div className="space-y-5">
            {Array.from(individualByGroup.entries()).map(([maSs, list]) => (
              <div key={maSs}>
                <p className="mb-2 text-xs font-semibold text-slate-500">
                  Nhóm {maSs === "khac" ? "Khác" : tenTheoMa(maSs)}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {list.map((r) => (
                    <Card key={r.id} padding="p-3.5">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {tenTheoMa(r.ma_nhan_vien)}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            tinhTrangTone(r.tinh_trang_chung ?? "") === "danger"
                              ? "bg-red-100 text-red-700"
                              : tinhTrangTone(r.tinh_trang_chung ?? "") === "warning"
                                ? "bg-amber-100 text-amber-700"
                                : tinhTrangTone(r.tinh_trang_chung ?? "") === "success"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {r.tinh_trang_chung}
                        </span>
                      </div>
                      {r.hanh_dong_de_xuat && r.hanh_dong_de_xuat.length > 0 && (
                        <ul className="space-y-1 text-xs text-slate-600">
                          {r.hanh_dong_de_xuat.map((h, i) => (
                            <li key={i} className="rounded-lg bg-slate-50 p-1.5">
                              <span
                                className={`mr-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                  priorityTone(h.uu_tien) === "danger"
                                    ? "bg-red-100 text-red-700"
                                    : priorityTone(h.uu_tien) === "warning"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {h.uu_tien}
                              </span>
                              {h.hanh_dong}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {processed.length > 0 && (
        <section>
          <SectionHeading title="Đã xử lý gần đây" />
          <div className="space-y-1.5">
            {processed.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs"
              >
                <span className="text-slate-700">
                  {tenTheoMa(f.ma_nhan_vien_thuc_hien)} — {f.hanh_dong_goc ?? "—"}
                </span>
                <span
                  title={
                    f.trang_thai_thuc_hien === TRANG_THAI_DIEU_CHINH
                      ? (f.quyet_dinh_quan_ly ?? undefined)
                      : undefined
                  }
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    f.thanh_cong === true
                      ? "bg-emerald-100 text-emerald-700"
                      : f.thanh_cong === false
                        ? "bg-red-100 text-red-700"
                        : f.trang_thai_thuc_hien === TRANG_THAI_DA_DUYET
                          ? "bg-emerald-100 text-emerald-700"
                          : f.trang_thai_thuc_hien === TRANG_THAI_DIEU_CHINH
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {f.thanh_cong === true
                    ? "Thành công"
                    : f.thanh_cong === false
                      ? "Chưa thành công"
                      : f.trang_thai_thuc_hien === TRANG_THAI_DA_DUYET
                        ? "Đã duyệt"
                        : f.trang_thai_thuc_hien === TRANG_THAI_DIEU_CHINH
                          ? "Đã bỏ / điều chỉnh"
                          : (f.quyet_dinh_quan_ly ?? f.trang_thai_thuc_hien ?? "—")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
