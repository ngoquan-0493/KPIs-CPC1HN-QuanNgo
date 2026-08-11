import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/current-employee";
import {
  DeXuatCard,
  ThemViecMoiForm,
  DuyetWeeklyReviewButton,
  XacNhanKetQuaCard,
  NvDeXuatCard,
  NvViecCuaToiCard,
} from "@/components/ai-review-actions";
import SsFilter from "@/components/ss-filter";
import NvFilter from "@/components/nv-filter";
import { ghepTenMa } from "@/lib/display";
import { Card, PageHeader, SectionHeading, EmptyState, Badge } from "@/components/ui";

type CanhBaoKiemTra = { loai: string; muc_do: string; mo_ta: string };

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
  da_kiem_tra: boolean | null;
  hop_le_kiem_tra: boolean | null;
  canh_bao_kiem_tra: CanhBaoKiemTra[] | null;
  do_tin_cay_sau_kiem_tra: number | null;
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
  trang_thai_nv: string | null;
  ly_do_tu_choi_nv: string | null;
  ly_do_chinh_sua: string | null;
  so_lan_chinh_sua: number | null;
  thanh_cong: boolean | null;
  tuan_bat_dau: string | null;
  ma_khach: string | null;
  created_at: string;
};

type TaskLienKet = {
  nguon_phan_hoi_ai_id: number;
  tuan_bat_dau: string | null;
  han_hoan_thanh: string | null;
};

type EmployeeRow = {
  "Mã nhân viên": string;
  "Tên nhân viên": string | null;
  SS: string | null;
  "Vị trí": string | null;
};

// 3 trang thai chuan cua phan_hoi_hoc_tu_ai (xac nhan voi ASM, khong doi
// schema): cho_tao_cong_viec/null = cho duyet; da_tao_task/approved = da
// duyet va da sinh viec that; tieu_chi_can_dieu_chinh/<ly do tu do> = da
// bo/dieu chinh.
const TRANG_THAI_CHO_DUYET = "cho_tao_cong_viec";
const TRANG_THAI_DA_DUYET = "da_tao_task";
const TRANG_THAI_DIEU_CHINH = "tieu_chi_can_dieu_chinh";

// trang_thai_nv: rieng cho phan hoi cua NV voi 1 de xuat DA DUYET, tach biet
// voi trang_thai_thuc_hien (quyet dinh cua SS/ASM). Xem trao doi thiet ke +
// migration add_nv_xac_nhan_columns_and_rpc.
const TRANG_THAI_NV_CHO_XAC_NHAN = "cho_xac_nhan";
const TRANG_THAI_NV_DA_XAC_NHAN = "da_xac_nhan";

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

// AI ghi cac gia tri uu_tien khong dau ("khan", "uu_tien", "binh_thuong"...) -
// dich sang tieng Viet co dau day du de hien thi, khong hien nguyen gia tri
// tho luu trong DB ra man hinh.
function priorityLabel(uuTien: string): string {
  const u = uuTien.trim().toLowerCase();
  if (u === "khan") return "Khẩn";
  if (u === "cao") return "Cao";
  if (u === "uu_tien") return "Ưu tiên";
  if (u === "trung_binh") return "Trung bình";
  if (u === "vua") return "Vừa";
  if (u === "binh_thuong") return "Bình thường";
  if (u === "thap") return "Thấp";
  return uuTien;
}

function tinhTrangTone(tinhTrang: string): "danger" | "warning" | "success" | "neutral" {
  const t = tinhTrang.toLowerCase();
  if (t.includes("can can thiep") || t.includes("báo động") || t.includes("bao dong")) return "danger";
  if (t.includes("can theo doi") || t.includes("cần theo dõi") || t.includes("chậm")) return "warning";
  if (t.includes("tot") || t.includes("tốt") || t.includes("on dinh") || t.includes("ổn định"))
    return "success";
  return "neutral";
}

// Tuong tu priorityLabel: AI thuong ghi tinh_trang_chung khong dau ("Tot",
// "On dinh", "Can theo doi", "Can can thiep"). Dich cac gia tri da biet sang
// co dau; neu AI da tra ve cau co dau san (hoac cum tu la, chua gap) thi giu
// nguyen, khong lam mat noi dung.
function tinhTrangLabel(tinhTrang: string): string {
  const t = tinhTrang.trim().toLowerCase();
  if (t === "can can thiep") return "Cần can thiệp";
  if (t === "can theo doi") return "Cần theo dõi";
  if (t === "on dinh") return "Ổn định";
  if (t === "tot") return "Tốt";
  return tinhTrang;
}

// Hien thi ket qua cua lop AI KIEM TRA (verification) chay sau AI Weekly
// Review Agent - chi hien khi co canh bao that (mang rong = khong ve gi ca,
// tranh gay nhieu cho nhung de xuat binh thuong). Do "cao" -> mau do, con lai
// -> mau vang. Danh cho ASM/SS xem TRUOC KHI duyet, khong hien o trang rieng
// cua NV vi quyet dinh tin/khong tin de xuat AI la cua ASM/SS.
function CanhBaoKiemTra({ canhBao }: { canhBao: CanhBaoKiemTra[] | null }) {
  if (!canhBao || canhBao.length === 0) return null;
  const coMucCao = canhBao.some((c) => c.muc_do === "cao");
  return (
    <div
      className={`mt-2 rounded-lg p-2 text-[11px] ${
        coMucCao ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      <p className="mb-1 font-medium">
        ⚠ AI kiểm tra phát hiện {canhBao.length} vấn đề — xem lại trước khi duyệt
      </p>
      <ul className="space-y-0.5 pl-3">
        {canhBao.map((c, i) => (
          <li key={i} className="list-disc">
            {c.mo_ta}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function AiReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ ss?: string; nv?: string }>;
}) {
  const supabase = await createClient();
  const { ss: selectedSs, nv: selectedNv } = await searchParams;
  const currentEmployee = await getCurrentEmployee();
  const isNvRole = currentEmployee?.["Vị trí"] === "NVKD";

  const [reviewsRes, feedbackRes, empRes] = await Promise.all([
    supabase
      .from("nhan_dinh_ai_tuan")
      .select(
        "id,tuan_bat_dau,cap_do_danh_gia,ma_ss,ma_nhan_vien,tinh_trang_chung,diem_hieu_qua,do_tin_cay_ai,rui_ro,hanh_dong_de_xuat,trang_thai_duyet,da_kiem_tra,hop_le_kiem_tra,canh_bao_kiem_tra,do_tin_cay_sau_kiem_tra",
      )
      .order("tuan_bat_dau", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
    supabase
      .from("phan_hoi_hoc_tu_ai")
      .select(
        "id,review_id,ma_nhan_vien_thuc_hien,ma_ss,kenh,nhom_khach_hang,san_pham,ket_qua_du_kien,hanh_dong_goc,quyet_dinh_quan_ly,trang_thai_thuc_hien,trang_thai_nv,ly_do_tu_choi_nv,ly_do_chinh_sua,so_lan_chinh_sua,thanh_cong,tuan_bat_dau,ma_khach,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("Danh sach nhan vien")
      .select('"Mã nhân viên":ma_nhan_vien,"Tên nhân viên":ten_nhan_vien,SS:ss,"Vị trí":vi_tri'),
  ]);

  const nameByCode = new Map<string, string>();
  const employeeSsMap = new Map<string, string | null>();
  const employeeList: { code: string; name: string }[] = [];
  const nvFilterOptions: { code: string; name: string }[] = [];
  for (const e of (empRes.data ?? []) as EmployeeRow[]) {
    const name = e["Tên nhân viên"] ?? e["Mã nhân viên"];
    nameByCode.set(e["Mã nhân viên"], name);
    employeeSsMap.set(e["Mã nhân viên"], e.SS);
    employeeList.push({ code: e["Mã nhân viên"], name });
    // Bo loc "theo nhan vien" chi can dan sale/TDV (nguoi thuc su co de xuat ca
    // nhan) - loai SS/ASM de tranh chon nham ma khong bao gio ra ket qua.
    if (e["Vị trí"] === "NVKD" || e["Vị trí"] === "TTS") {
      if (!selectedSs || e.SS === selectedSs) {
        nvFilterOptions.push({ code: e["Mã nhân viên"], name });
      }
    }
  }
  employeeList.sort((a, b) => a.name.localeCompare(b.name));
  nvFilterOptions.sort((a, b) => a.name.localeCompare(b.name));
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
  if (selectedNv) {
    individualReviews = individualReviews.filter((r) => r.ma_nhan_vien === selectedNv);
  }
  const individualByGroup = new Map<string, WeeklyReview[]>();
  for (const r of individualReviews) {
    const key = r.ma_ss ?? "khac";
    if (!individualByGroup.has(key)) individualByGroup.set(key, []);
    individualByGroup.get(key)!.push(r);
  }

  let allFeedback = (
    selectedSs
      ? ((feedbackRes.data ?? []) as Feedback[]).filter(
          (f) => employeeSsMap.get(f.ma_nhan_vien_thuc_hien) === selectedSs,
        )
      : ((feedbackRes.data ?? []) as Feedback[])
  );
  if (selectedNv) {
    allFeedback = allFeedback.filter((f) => f.ma_nhan_vien_thuc_hien === selectedNv);
  }
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
          .select("nguon_phan_hoi_ai_id,tuan_bat_dau,han_hoan_thanh")
          .in("nguon_phan_hoi_ai_id", canXacNhanIds)
      : { data: [] as TaskLienKet[], error: null };
  const hanHoanThanhByFeedbackId = new Map<number, string | null>();
  const tuanBatDauByFeedbackId = new Map<number, string | null>();
  for (const t of (taskLienKetRes.data ?? []) as TaskLienKet[]) {
    hanHoanThanhByFeedbackId.set(t.nguon_phan_hoi_ai_id, t.han_hoan_thanh);
    tuanBatDauByFeedbackId.set(t.nguon_phan_hoi_ai_id, t.tuan_bat_dau);
  }

  // NV can hanh dong: de xuat da duyet (da_tao_task) nhung chua xac nhan/tu
  // choi. Rieng cho vai tro NVKD - RLS da tu gioi han allFeedback ve dung
  // cua ho nen khong can loc them theo ma_nhan_vien.
  const nvCanXacNhan = allFeedback.filter(
    (f) =>
      f.trang_thai_thuc_hien === TRANG_THAI_DA_DUYET &&
      (f.trang_thai_nv === TRANG_THAI_NV_CHO_XAC_NHAN || !f.trang_thai_nv),
  );
  const nvDaXacNhanChoKetQua = allFeedback.filter(
    (f) => f.trang_thai_thuc_hien === TRANG_THAI_DA_DUYET && f.trang_thai_nv === TRANG_THAI_NV_DA_XAC_NHAN,
  );

  // Gom de xuat dang cho duyet theo tung nhan vien - truoc day liet ke phang
  // theo created_at nen 1 NV co nhieu de xuat bi tach roi, xen ke voi NV khac,
  // kho theo doi. Sap xep nhom theo ten NV cho de doc.
  const pendingByNv = new Map<string, Feedback[]>();
  for (const f of pending) {
    const key = f.ma_nhan_vien_thuc_hien;
    if (!pendingByNv.has(key)) pendingByNv.set(key, []);
    pendingByNv.get(key)!.push(f);
  }
  const pendingGroups = Array.from(pendingByNv.entries())
    .map(([maNv, items]) => ({
      maNv,
      employeeName: tenTheoMa(maNv),
      ssName: items[0]?.ma_ss ? tenTheoMa(items[0].ma_ss) : null,
      items,
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  const canXacNhanSet = new Set(canXacNhan.map((f) => f.id));
  const processed = allFeedback
    .filter((f) => !pending.includes(f) && !canXacNhanSet.has(f.id))
    .slice(0, 20);

  const error = reviewsRes.error ?? feedbackRes.error ?? empRes.error ?? taskLienKetRes.error;

  // Vai tro NVKD: giao dien rieng, chi thay viec cua chinh minh (RLS da tu
  // gioi han du lieu tra ve), khong co nut Duyet/Bo-dieu chinh/Xac nhan ket
  // qua cua SS/ASM.
  if (isNvRole) {
    return (
      <div className="mx-auto max-w-[900px] p-6 lg:p-8">
        <PageHeader
          title="Việc của tôi"
          description="Đề xuất hành động do AI/SS/ASM đưa ra cho bạn. Xác nhận nếu bạn sẽ làm, chỉnh sửa nếu sai thông tin, hoặc từ chối kèm lý do."
        />

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            Lỗi tải dữ liệu: {error.message}
          </p>
        )}

        <section className="mb-8">
          <SectionHeading title="Cần bạn xác nhận" count={nvCanXacNhan.length} />
          {nvCanXacNhan.length === 0 ? (
            <EmptyState>Không có đề xuất nào cần bạn xác nhận.</EmptyState>
          ) : (
            <div className="space-y-2">
              {nvCanXacNhan.map((f) => (
                <NvDeXuatCard key={f.id} feedback={f} />
              ))}
            </div>
          )}
        </section>

        {(pending.length > 0 || nvDaXacNhanChoKetQua.length > 0) && (
          <section className="mb-8">
            <SectionHeading title="Đang chờ xử lý" />
            <div className="space-y-1.5">
              {pending.map((f) => (
                <NvViecCuaToiCard
                  key={f.id}
                  noiDung={f.hanh_dong_goc}
                  trangThai="Chờ SS/ASM duyệt đề xuất"
                  tone="neutral"
                />
              ))}
              {nvDaXacNhanChoKetQua.map((f) => (
                <NvViecCuaToiCard
                  key={f.id}
                  noiDung={f.hanh_dong_goc}
                  trangThai="Bạn đã xác nhận — chờ SS/ASM xác nhận kết quả"
                  tone="brand"
                />
              ))}
            </div>
          </section>
        )}

        {individualReviews.length > 0 && (
          <section className="mb-8">
            <SectionHeading title={`Đánh giá AI tuần ${latestWeek ?? "—"}`} />
            <div className="space-y-2">
              {individualReviews.map((r) => (
                <Card key={r.id} padding="p-3.5">
                  <div className="mb-1 flex items-center justify-between gap-2">
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
                      {tinhTrangLabel(r.tinh_trang_chung ?? "")}
                    </span>
                  </div>
                  {r.hanh_dong_de_xuat && r.hanh_dong_de_xuat.length > 0 && (
                    <ul className="space-y-1 text-xs text-slate-600">
                      {r.hanh_dong_de_xuat.map((h, i) => (
                        <li key={i} className="rounded-lg bg-slate-50 p-1.5">
                          {h.hanh_dong}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {processed.length > 0 && (
          <section>
            <SectionHeading title="Lịch sử của tôi" />
            <div className="space-y-1.5">
              {processed.map((f) => (
                <NvViecCuaToiCard
                  key={f.id}
                  noiDung={f.hanh_dong_goc}
                  trangThai={
                    f.thanh_cong === true
                      ? "Thành công"
                      : f.thanh_cong === false
                        ? "Chưa thành công"
                        : f.trang_thai_nv === "tu_choi"
                          ? `Bạn đã từ chối${f.ly_do_tu_choi_nv ? `: ${f.ly_do_tu_choi_nv}` : ""}`
                          : f.trang_thai_thuc_hien === TRANG_THAI_DIEU_CHINH
                            ? "Đã bỏ / điều chỉnh"
                            : (f.quyet_dinh_quan_ly ?? f.trang_thai_thuc_hien ?? "—")
                  }
                  tone={
                    f.thanh_cong === true
                      ? "success"
                      : f.thanh_cong === false
                        ? "danger"
                        : f.trang_thai_nv === "tu_choi" || f.trang_thai_thuc_hien === TRANG_THAI_DIEU_CHINH
                          ? "warning"
                          : "neutral"
                  }
                />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-8">
      <PageHeader
        title="Đề xuất & Đánh giá AI"
        description="Duyệt đề xuất hành động sẽ tạo ngay công việc tuần cho nhân viên; bỏ/điều chỉnh cần nêu lý do để AI học lại. Xem thêm đánh giá AI hàng tuần theo nhóm SS bên dưới."
        actions={
          <>
            {ssList.length > 0 && <SsFilter ssList={ssList} />}
            {nvFilterOptions.length > 0 && <NvFilter employees={nvFilterOptions} />}
          </>
        }
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
          <div className="space-y-4">
            {pendingGroups.map((g) => (
              <div key={g.maNv}>
                <div className="mb-1.5 flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{g.employeeName}</p>
                  {g.ssName && (
                    <span className="text-xs text-slate-400">· SS {g.ssName}</span>
                  )}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {g.items.length} đề xuất
                  </span>
                </div>
                <div className="space-y-2">
                  {g.items.map((f) => (
                    <DeXuatCard
                      key={f.id}
                      feedback={f}
                      employeeName={g.employeeName}
                      ssName={g.ssName}
                      hideEmployeeName
                    />
                  ))}
                </div>
              </div>
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
                tuanBatDau={tuanBatDauByFeedbackId.get(f.id) ?? null}
                trangThaiNv={f.trang_thai_nv}
                maKhach={f.ma_khach}
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
                <p className="mb-2 text-sm text-slate-700">{tinhTrangLabel(r.tinh_trang_chung ?? "")}</p>
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
                            {priorityLabel(h.uu_tien)}
                          </span>
                          {h.hanh_dong}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <CanhBaoKiemTra canhBao={r.canh_bao_kiem_tra} />
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
                          {tinhTrangLabel(r.tinh_trang_chung ?? "")}
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
                                {priorityLabel(h.uu_tien)}
                              </span>
                              {h.hanh_dong}
                            </li>
                          ))}
                        </ul>
                      )}
                      <CanhBaoKiemTra canhBao={r.canh_bao_kiem_tra} />
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
            {processed.map((f) => {
              // Uu tien ly do cua NV (tu_choi) neu co - day chinh la khoang
              // trong da phat hien khi ra soat: truoc day muc nay chi hien
              // quyet_dinh_quan_ly (thuong la text cua SS/ASM), nen ly do NV
              // tu choi bi that lac, khong ai doc lai duoc khi xem lich su.
              const lyDoHienThi =
                f.trang_thai_nv === "tu_choi" && f.ly_do_tu_choi_nv
                  ? `NV từ chối: ${f.ly_do_tu_choi_nv}`
                  : f.trang_thai_thuc_hien === TRANG_THAI_DIEU_CHINH
                    ? f.quyet_dinh_quan_ly
                    : null;
              return (
                <div
                  key={f.id}
                  className="flex flex-col gap-0.5 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-700">
                      {tenTheoMa(f.ma_nhan_vien_thuc_hien)} — {f.hanh_dong_goc ?? "—"}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${
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
                  {lyDoHienThi && <p className="text-[11px] text-slate-500">Lý do: {lyDoHienThi}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
