"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/current-employee";
import { revalidatePath } from "next/cache";
import { layCauHinhChiTieu } from "@/lib/kpi-chi-tieu";

// Chuan hoa ma NV (co/khong so 0 dau) - dung chung voi cac trang khac
// (sales/kpi/customers).
function normCode(code: string | null | undefined) {
  return (code ?? "").replace(/\D/g, "").replace(/^0+/, "") || code || "";
}

// Chan quyen thao tac quan ly (duyet/tu choi/sua dong da duyet) o TANG
// SERVER, khong dua hoan toan vao RLS - cung pattern voi ai-review/actions.ts.
async function assertQuanLy(): Promise<void> {
  const employee = await getCurrentEmployee();
  const viTri = employee?.["Vị trí"];
  if (viTri !== "SS" && viTri !== "ASM") {
    throw new Error("Chỉ SS/ASM mới có quyền thực hiện thao tác này.");
  }
}

// Tra ve ma_nhan_vien CHUAN (dung CHINH XAC dinh dang dang luu trong "Danh
// sach nhan vien") tu 1 ma bat ky (co the da bi strip so 0 dau o phia client).
// Bat buoc phai chuan hoa TRUOC KHI ghi vao "Chi tieu KPIs" - neu khong, dong
// SS/ASM tao thay se bi luu voi 1 chuoi ma_nhan_vien KHAC voi ma chinh chu
// (vd "018074" -> "18074"), khien no bi tach thanh "nhan vien ao" thu 2, NV
// that khong thay dong do khi tu vao xem KPI cua minh (bug da xac nhan qua
// du lieu thuc te: 5 NV / 33 dong bi lech ma truoc khi co fix nay).
async function chuanHoaMaNhanVien(
  supabase: Awaited<ReturnType<typeof createClient>>,
  maBatKy: string,
): Promise<string> {
  const target = maBatKy.trim();
  if (!target) return target;

  const { data } = await supabase.from("Danh sach nhan vien").select("ma_nhan_vien");
  const match = (data ?? []).find((e) => normCode(e.ma_nhan_vien as string) === normCode(target));
  return (match?.ma_nhan_vien as string) ?? target;
}

// Xac dinh NV se duoc xay dung KPI: mac dinh la chinh nguoi goi. SS/ASM co
// the xay/sua thay cho 1 NV duoi quyen (giao ma_nhan_vien khac chinh minh) -
// RLS (scoped insert/update theo visible_employee_codes()) van la lop chan
// cuoi cung neu buoc kiem tra nay bi bo qua.
async function xacDinhNvMucTieu(maNhanVienMucTieu?: string) {
  const employee = await getCurrentEmployee();
  if (!employee) throw new Error("Không xác định được nhân viên đang đăng nhập.");

  const maChinhMinh = employee["Mã nhân viên"];
  const targetRaw = maNhanVienMucTieu?.trim() || maChinhMinh;
  const laTaoThay = normCode(targetRaw) !== normCode(maChinhMinh);

  if (laTaoThay && employee["Vị trí"] !== "SS" && employee["Vị trí"] !== "ASM") {
    throw new Error("Chỉ SS/ASM mới có quyền xây dựng KPI thay cho nhân viên khác.");
  }

  const supabase = await createClient();
  const target = laTaoThay ? await chuanHoaMaNhanVien(supabase, targetRaw) : maChinhMinh;

  return { maChinhMinh, target, viTri: employee["Vị trí"] };
}

export type KpiDraftInput = {
  id?: string;
  maNhanVien: string;
  thangDanhGia: string; // "YYYY-MM-01"
  chiTieu: string;
  maKhach?: string | null;
  tenKhach?: string | null; // chi de hien thi, khong luu rieng cot
  sanPham?: string | null; // ten san pham chuan hoa (Mo moi*/Duy tri*), hoac null
  soTienKeHoach?: number | null; // Doanh so*
  soLuongKhachHangKeHoach?: number | null;
  sanLuongKeHoachToiThieu?: number | null;
  nguongNhom?: number | null; // so_luong_toi_thieu_can_dat - gia tri CAP NHOM, xem apDungNguongNhom()
  diemKpisKeHoach: number;
  ghiChu?: string | null;
};

// Ep du lieu tho tu form thanh dung cot Supabase theo nhom chi_tieu - validate
// day du de tranh ghi du lieu khong khop voi cach 09a doi chieu (vi du thieu
// san pham cho "Duy trì SPTT" se khien 09a khong bao gio tinh duoc dong nay).
function chuanHoaDauVao(input: KpiDraftInput) {
  const cauHinh = layCauHinhChiTieu(input.chiTieu);
  if (!cauHinh) throw new Error(`Chỉ tiêu không hợp lệ: ${input.chiTieu}`);

  if (!/^\d{4}-\d{2}-01$/.test(input.thangDanhGia)) {
    throw new Error("Tháng đánh giá không hợp lệ.");
  }
  if (!Number.isFinite(input.diemKpisKeHoach) || input.diemKpisKeHoach < 0) {
    throw new Error("Điểm KPI kế hoạch phải là số không âm.");
  }

  const row: Record<string, unknown> = {
    ma_nhan_vien: input.maNhanVien,
    thang_danh_gia: input.thangDanhGia,
    chi_tieu: input.chiTieu,
    diem_kpis_ke_hoach: input.diemKpisKeHoach,
    diem_kpis: null,
    so_luong_thuc_hien: null,
    ti_trong_thuc_hien_ke_hoach: null,
    ket_qua: null,
    ghi_chu: input.ghiChu?.trim() || null,
  };

  if (cauHinh.nhom === "doanh_so") {
    const soTien = input.soTienKeHoach;
    if (!Number.isFinite(soTien) || (soTien ?? 0) <= 0) {
      throw new Error("Cần nhập số tiền kế hoạch lớn hơn 0.");
    }
    row.chi_tiet_ke_hoach_san_pham = String(Math.round(soTien as number));
    row.ma_khach = null;
    return row;
  }

  if (cauHinh.canSanPham) {
    if (!input.sanPham?.trim()) throw new Error("Cần chọn sản phẩm từ danh sách.");
    row.chi_tiet_ke_hoach_san_pham = input.sanPham.trim();
  } else {
    row.chi_tiet_ke_hoach_san_pham = cauHinh.ghiChuMacDinh ?? null;
  }

  if (cauHinh.canKhachHang) {
    if (!input.maKhach?.trim()) throw new Error("Cần chọn khách hàng từ danh sách.");
    row.ma_khach = input.maKhach.trim();
  } else {
    row.ma_khach = null;
  }

  if (cauHinh.canSoLuongKhach) {
    if (!Number.isFinite(input.soLuongKhachHangKeHoach) || (input.soLuongKhachHangKeHoach ?? 0) <= 0) {
      throw new Error("Cần nhập số lượng khách hàng kế hoạch lớn hơn 0.");
    }
    row.so_luong_khach_hang_ke_hoach = input.soLuongKhachHangKeHoach;
  } else {
    row.so_luong_khach_hang_ke_hoach = null;
  }

  if (cauHinh.canSanLuongToiThieu) {
    if (
      !Number.isFinite(input.sanLuongKeHoachToiThieu) ||
      (input.sanLuongKeHoachToiThieu ?? 0) <= 0
    ) {
      throw new Error("Cần nhập sản lượng kế hoạch tối thiểu lớn hơn 0.");
    }
    row.san_luong_ke_hoach_toi_thieu = input.sanLuongKeHoachToiThieu;
  } else {
    row.san_luong_ke_hoach_toi_thieu = null;
  }

  if (cauHinh.canNguongNhom && input.nguongNhom != null && Number.isFinite(input.nguongNhom)) {
    row.so_luong_toi_thieu_can_dat = input.nguongNhom;
  }

  return row;
}

// Ap dung nguong hoan thanh nhom va/hoac diem KPI ke hoach NHOM cho TOAN BO
// cac dong cung (NV, chi_tieu, thang) - dung sau khi insert/update 1 dong de
// cac dong san co khac trong cung nhom cung duoc dong bo theo, tranh tinh
// trang moi dong 1 gia tri khac nhau. Ap dung cho "Duy trì SPTT"/"Duy trì" -
// 2 chi_tieu duy nhat co canNguongNhom=true VA diem_kpis_ke_hoach la 1 con so
// TONG cho ca nhom (khong cong don tung dong nhu cac chi_tieu khac) - xem
// lib/kpi-chi-tieu.ts va cong thuc moi trong workflow n8n "09b Tong Hop Diem
// KPI" (per_group_adj: diem_thuc_hien_nhom = ke_hoach_nhom/nguong*so_dat).
async function apDungGiaTriNhom(
  supabase: Awaited<ReturnType<typeof createClient>>,
  maNhanVien: string,
  chiTieu: string,
  thangDanhGia: string,
  giaTri: { nguong?: number | null; diemKeHoach?: number | null },
) {
  const update: Record<string, number> = {};
  if (giaTri.nguong != null && Number.isFinite(giaTri.nguong) && giaTri.nguong > 0) {
    update.so_luong_toi_thieu_can_dat = giaTri.nguong;
  }
  if (giaTri.diemKeHoach != null && Number.isFinite(giaTri.diemKeHoach) && giaTri.diemKeHoach >= 0) {
    update.diem_kpis_ke_hoach = giaTri.diemKeHoach;
  }
  if (Object.keys(update).length === 0) return;

  const { error } = await supabase
    .from("Chi tieu KPIs")
    .update(update)
    .eq("ma_nhan_vien", maNhanVien)
    .eq("chi_tieu", chiTieu)
    .eq("thang_danh_gia", thangDanhGia);
  if (error) throw new Error(error.message);
}

// Tao 1 dong KPI moi o trang thai "nhap" cho NV muc tieu + thang dang chon.
export async function taoDongKpiNhap(input: KpiDraftInput) {
  const { target, maChinhMinh } = await xacDinhNvMucTieu(input.maNhanVien);
  const row = chuanHoaDauVao({ ...input, maNhanVien: target });
  const supabase = await createClient();

  const { error } = await supabase.from("Chi tieu KPIs").insert({
    ...row,
    trang_thai_duyet: "nhap",
    nguoi_tao: maChinhMinh,
  });
  if (error) throw new Error(error.message);

  // Voi "Duy trì SPTT"/"Duy trì": diem_kpis_ke_hoach LA GIA TRI TONG CHO CA
  // NHOM (khong phai rieng dong nay) - luon dong bo ngay sau khi them dong,
  // cung voi nguong hoan thanh nhom neu co nhap.
  const cauHinh = layCauHinhChiTieu(input.chiTieu);
  if (cauHinh?.canNguongNhom) {
    await apDungGiaTriNhom(supabase, target, input.chiTieu, input.thangDanhGia, {
      nguong: input.nguongNhom,
      diemKeHoach: input.diemKpisKeHoach,
    });
  }

  revalidatePath("/kpi");
}

// Sua 1 dong dang "nhap"/"tu_choi" cua chinh minh (hoac cua NV duoi quyen
// neu la SS/ASM). Dong da "cho_duyet"/"da_duyet" bi trigger chan sua neu
// nguoi goi khong phai SS/ASM - xem chi_tieu_kpis_before_update() migration.
export async function capNhatDongKpiNhap(id: string, input: KpiDraftInput) {
  const { target } = await xacDinhNvMucTieu(input.maNhanVien);
  const row = chuanHoaDauVao({ ...input, maNhanVien: target });
  const supabase = await createClient();

  const { error } = await supabase.from("Chi tieu KPIs").update(row).eq("id", id);
  if (error) throw new Error(error.message);

  const cauHinh = layCauHinhChiTieu(input.chiTieu);
  if (cauHinh?.canNguongNhom) {
    await apDungGiaTriNhom(supabase, target, input.chiTieu, input.thangDanhGia, {
      nguong: input.nguongNhom,
      diemKeHoach: input.diemKpisKeHoach,
    });
  }

  revalidatePath("/kpi");
}

// Xoa 1 dong con "nhap" (RLS "scoped delete draft" chi cho xoa dong nhap).
export async function xoaDongKpiNhap(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("Chi tieu KPIs")
    .delete()
    .eq("id", id)
    .eq("trang_thai_duyet", "nhap");
  if (error) throw new Error(error.message);

  revalidatePath("/kpi");
}

// Gui 1 dong (nhap/tu_choi) len "cho_duyet" - trigger tu dong ghi
// ngay_gui_duyet.
export async function guiDuyet(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("Chi tieu KPIs")
    .update({ trang_thai_duyet: "cho_duyet" })
    .eq("id", id)
    .in("trang_thai_duyet", ["nhap", "tu_choi"])
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Không tìm thấy dòng này ở trạng thái có thể gửi duyệt.");

  revalidatePath("/kpi");
}

// Gui hang loat tat ca dong "nhap" cua 1 NV trong 1 thang - dung cho nut
// "Gui duyet tat ca" o trang xay dung.
export async function guiDuyetTatCa(maNhanVien: string, thangDanhGia: string) {
  const { target } = await xacDinhNvMucTieu(maNhanVien);
  const supabase = await createClient();
  const { error } = await supabase
    .from("Chi tieu KPIs")
    .update({ trang_thai_duyet: "cho_duyet" })
    .eq("ma_nhan_vien", target)
    .eq("thang_danh_gia", thangDanhGia)
    .in("trang_thai_duyet", ["nhap", "tu_choi"]);
  if (error) throw new Error(error.message);

  revalidatePath("/kpi");
}

// Ap dung 1 nguong hoan thanh nhom (so_luong_toi_thieu_can_dat) cho TAT CA
// cac dong cung (NV, chi_tieu, thang) - day la gia tri cap NHOM (xac nhan
// bang du lieu thuc te luon giong nhau tren moi dong cung nhom), khong nhap
// rieng tung dong san pham/khach hang.
export async function datNguongNhom(
  maNhanVien: string,
  chiTieu: string,
  thangDanhGia: string,
  nguong: number,
) {
  const { target } = await xacDinhNvMucTieu(maNhanVien);
  if (!Number.isFinite(nguong) || nguong <= 0) {
    throw new Error("Ngưỡng hoàn thành nhóm phải là số lớn hơn 0.");
  }
  const supabase = await createClient();
  await apDungGiaTriNhom(supabase, target, chiTieu, thangDanhGia, { nguong });

  revalidatePath("/kpi");
}

// SS/ASM dat nguong nhom truc tiep tu man hinh phe duyet (khong bi rang buoc
// boi xacDinhNvMucTieu() - SS/ASM luon nam trong pham vi RLS cua NV duoi
// quyen minh roi, chi can assertQuanLy()).
export async function datNguongNhomChoDuyet(
  maNhanVien: string,
  chiTieu: string,
  thangDanhGia: string,
  nguong: number,
) {
  await assertQuanLy();
  if (!Number.isFinite(nguong) || nguong <= 0) {
    throw new Error("Ngưỡng hoàn thành nhóm phải là số lớn hơn 0.");
  }
  const supabase = await createClient();
  await apDungGiaTriNhom(supabase, maNhanVien, chiTieu, thangDanhGia, { nguong });

  revalidatePath("/kpi");
}

// Dat diem KPI ke hoach TONG cho ca nhom "Duy trì SPTT"/"Duy trì" - dung khi
// muon chinh lai rieng gia tri nay ma khong them/sua dong nao (vd sau khi da
// co san du lieu tu Google Sheet cu, chua dong bo dung theo quy uoc moi).
export async function datDiemKeHoachNhom(
  maNhanVien: string,
  chiTieu: string,
  thangDanhGia: string,
  diemKeHoach: number,
) {
  const { target } = await xacDinhNvMucTieu(maNhanVien);
  if (!Number.isFinite(diemKeHoach) || diemKeHoach < 0) {
    throw new Error("Điểm KPI kế hoạch phải là số không âm.");
  }
  const supabase = await createClient();
  await apDungGiaTriNhom(supabase, target, chiTieu, thangDanhGia, { diemKeHoach });

  revalidatePath("/kpi");
}

export async function datDiemKeHoachNhomChoDuyet(
  maNhanVien: string,
  chiTieu: string,
  thangDanhGia: string,
  diemKeHoach: number,
) {
  await assertQuanLy();
  if (!Number.isFinite(diemKeHoach) || diemKeHoach < 0) {
    throw new Error("Điểm KPI kế hoạch phải là số không âm.");
  }
  const supabase = await createClient();
  await apDungGiaTriNhom(supabase, maNhanVien, chiTieu, thangDanhGia, { diemKeHoach });

  revalidatePath("/kpi");
}

// ==================== Phe duyet (SS/ASM) ====================

export async function duyetDongKpi(id: string) {
  await assertQuanLy();
  const supabase = await createClient();
  const { error } = await supabase
    .from("Chi tieu KPIs")
    .update({ trang_thai_duyet: "da_duyet", ghi_chu_duyet: null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/kpi");
}

export async function duyetHangLoatChoNv(maNhanVien: string, thangDanhGia: string) {
  await assertQuanLy();
  const supabase = await createClient();
  const { error } = await supabase
    .from("Chi tieu KPIs")
    .update({ trang_thai_duyet: "da_duyet", ghi_chu_duyet: null })
    .eq("ma_nhan_vien", maNhanVien)
    .eq("thang_danh_gia", thangDanhGia)
    .eq("trang_thai_duyet", "cho_duyet");
  if (error) throw new Error(error.message);

  revalidatePath("/kpi");
}

export async function tuChoiDongKpi(id: string, lyDo: string) {
  await assertQuanLy();
  const trimmed = lyDo.trim();
  if (!trimmed) throw new Error("Cần nhập lý do trước khi từ chối.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("Chi tieu KPIs")
    .update({ trang_thai_duyet: "tu_choi", ghi_chu_duyet: trimmed })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/kpi");
}

// SS/ASM sua truc tiep 1 dong (bat ky trang thai nao, ke ca da duyet) roi
// duyet luon trong 1 buoc - dung khi SS thay so lieu NV nhap chua hop ly va
// muon chinh lai thay vi tu choi/cho NV sua lai.
export async function suaVaDuyetDongKpi(id: string, input: KpiDraftInput) {
  await assertQuanLy();
  const { target } = await xacDinhNvMucTieu(input.maNhanVien);
  const row = chuanHoaDauVao({ ...input, maNhanVien: target });
  const supabase = await createClient();

  const { error } = await supabase
    .from("Chi tieu KPIs")
    .update({ ...row, trang_thai_duyet: "da_duyet", ghi_chu_duyet: null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/kpi");
}

// Dua 1 dong DA DUYET tro lai "nhap" (SS/ASM mo lai cho NV sua khi phat hien
// van de sau khi da duyet).
export async function moLaiDongKpi(id: string) {
  await assertQuanLy();
  const supabase = await createClient();
  const { error } = await supabase
    .from("Chi tieu KPIs")
    .update({ trang_thai_duyet: "nhap", ghi_chu_duyet: null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/kpi");
}

// Xoa han 1 dong KPI o BAT KY trang thai nao (nhap/cho_duyet/da_duyet/
// tu_choi) - danh cho SS/ASM don dep truc tiep tu man hinh Phe duyet, khac
// voi xoaDongKpiNhap() (chi cho chinh NV xoa dong "nhap" cua minh o man hinh
// Xay dung).
export async function xoaDongKpi(id: string) {
  await assertQuanLy();
  const supabase = await createClient();
  const { error } = await supabase.from("Chi tieu KPIs").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/kpi");
}

export type DieuChinhKeHoachInput = {
  soLuongKhachHangKeHoach?: number | null;
  sanLuongKeHoachToiThieu?: number | null;
  soLuongToiThieuCanDat?: number | null;
  soTienKeHoach?: number | null; // Doanh so* - luu vao chi_tiet_ke_hoach_san_pham (chuoi so)
  diemKpisKeHoach?: number | null;
};

// SS/ASM chinh lai CAC GIA TRI KE HOACH cua 1 dong o BAT KY trang thai nao,
// KHONG dong thoi doi trang_thai_duyet (khac suaVaDuyetDongKpi() - ham do vua
// sua vua tu dong duyet luon). Chi cap nhat truong nao duoc truyen vao (khac
// undefined) - cho phep sua rieng 1-2 truong ma khong dong lai ca dong.
export async function dieuChinhKeHoachDongKpi(id: string, input: DieuChinhKeHoachInput) {
  await assertQuanLy();
  const row: Record<string, number | string | null> = {};

  if (input.soLuongKhachHangKeHoach !== undefined) {
    row.so_luong_khach_hang_ke_hoach = input.soLuongKhachHangKeHoach;
  }
  if (input.sanLuongKeHoachToiThieu !== undefined) {
    row.san_luong_ke_hoach_toi_thieu = input.sanLuongKeHoachToiThieu;
  }
  if (input.soLuongToiThieuCanDat !== undefined) {
    row.so_luong_toi_thieu_can_dat = input.soLuongToiThieuCanDat;
  }
  if (input.soTienKeHoach !== undefined) {
    if (input.soTienKeHoach == null || !Number.isFinite(input.soTienKeHoach) || input.soTienKeHoach <= 0) {
      throw new Error("Số tiền kế hoạch phải là số lớn hơn 0.");
    }
    row.chi_tiet_ke_hoach_san_pham = String(Math.round(input.soTienKeHoach));
  }
  if (input.diemKpisKeHoach !== undefined) {
    if (input.diemKpisKeHoach == null || !Number.isFinite(input.diemKpisKeHoach) || input.diemKpisKeHoach < 0) {
      throw new Error("Điểm KPI kế hoạch phải là số không âm.");
    }
    row.diem_kpis_ke_hoach = input.diemKpisKeHoach;
  }
  if (Object.keys(row).length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("Chi tieu KPIs").update(row).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/kpi");
}

// ==================== Tim kiem danh sach tong (khong gioi han theo NV) ====================

export type KetQuaTimKhach = { ma_khach: string; ten_khach: string | null };

// Danh sach khach hang de chon lam muc tieu "Duy tri*" - lay tu TOAN BO
// khach_hang_master (khong loc theo NV phu trach), dung nhu yeu cau: "khách
// hàng này lấy từ danh sách tổng, không bắt buộc phải là từng gán với nhân
// viên đó mới chọn được". RLS cua khach_hang_master van gioi han theo pham vi
// nhin thay cua nguoi dang dang nhap (NV/SS/ASM), khong phai gioi han theo
// "ai dang phu trach khach nay".
export async function timKiemKhachHang(q: string): Promise<KetQuaTimKhach[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("khach_hang_master")
    .select("ma_khach,ten_khach")
    .or(`ten_khach.ilike.%${query}%,ma_khach.ilike.%${query}%`)
    .order("ten_khach", { ascending: true })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as KetQuaTimKhach[];
}

// Danh sach san pham chuan hoa de chon cho "Mo moi*"/"Duy tri*" - tu
// danh_muc_chuan_hoa_san_pham (danh sach tong, khong gioi han theo NV).
export async function timKiemSanPham(q: string): Promise<string[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("danh_muc_chuan_hoa_san_pham")
    .select("ten_chuan")
    .ilike("ten_chuan", `%${query}%`)
    .not("ten_chuan", "is", null)
    .limit(100);
  if (error) throw new Error(error.message);

  const uniq = Array.from(new Set((data ?? []).map((r) => r.ten_chuan as string).filter(Boolean)));
  uniq.sort((a, b) => a.localeCompare(b));
  return uniq.slice(0, 20);
}

// ==================== Doc du lieu theo thang (dung khi doi thang tren client) ====================

export type ChiTieuKpiRow = {
  id: string;
  ma_nhan_vien: string;
  chi_tieu: string;
  chi_tiet_ke_hoach_san_pham: string | null;
  ma_khach: string | null;
  so_luong_khach_hang_ke_hoach: number | null;
  san_luong_ke_hoach_toi_thieu: number | null;
  so_luong_toi_thieu_can_dat: number | null;
  diem_kpis_ke_hoach: number | null;
  trang_thai_duyet: string;
  ghi_chu_duyet: string | null;
  ghi_chu: string | null;
  nguoi_tao: string | null;
  thang_danh_gia: string;
};

export async function layDanhSachKpiTheoThang(
  maNhanVien: string,
  thangDanhGia: string,
): Promise<ChiTieuKpiRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("Chi tieu KPIs")
    .select(
      "id,ma_nhan_vien,chi_tieu,chi_tiet_ke_hoach_san_pham,ma_khach,so_luong_khach_hang_ke_hoach,san_luong_ke_hoach_toi_thieu,so_luong_toi_thieu_can_dat,diem_kpis_ke_hoach,trang_thai_duyet,ghi_chu_duyet,ghi_chu,nguoi_tao,thang_danh_gia",
    )
    .eq("ma_nhan_vien", maNhanVien)
    .eq("thang_danh_gia", thangDanhGia)
    .order("chi_tieu", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ChiTieuKpiRow[];
}

export type ChoDuyetGroup = {
  ma_nhan_vien: string;
  rows: ChiTieuKpiRow[];
};

const KPI_COLUMNS =
  "id,ma_nhan_vien,chi_tieu,chi_tiet_ke_hoach_san_pham,ma_khach,so_luong_khach_hang_ke_hoach,san_luong_ke_hoach_toi_thieu,so_luong_toi_thieu_can_dat,diem_kpis_ke_hoach,trang_thai_duyet,ghi_chu_duyet,ghi_chu,nguoi_tao,thang_danh_gia";

function gomTheoNv(rows: ChiTieuKpiRow[]): ChoDuyetGroup[] {
  const byNv = new Map<string, ChiTieuKpiRow[]>();
  for (const r of rows) {
    const key = r.ma_nhan_vien;
    if (!byNv.has(key)) byNv.set(key, []);
    byNv.get(key)!.push(r);
  }
  return Array.from(byNv.entries()).map(([ma_nhan_vien, rows]) => ({ ma_nhan_vien, rows }));
}

// Danh sach cac dong "cho_duyet" trong pham vi nhin thay cua SS/ASM dang
// dang nhap (RLS scoped read tu lo), gom theo NV, cho thang dang chon.
export async function layDanhSachChoDuyet(thangDanhGia: string): Promise<ChoDuyetGroup[]> {
  await assertQuanLy();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("Chi tieu KPIs")
    .select(KPI_COLUMNS)
    .eq("thang_danh_gia", thangDanhGia)
    .eq("trang_thai_duyet", "cho_duyet")
    .order("ma_nhan_vien", { ascending: true });
  if (error) throw new Error(error.message);

  return gomTheoNv((data ?? []) as ChiTieuKpiRow[]);
}

// Toan bo dong KPI (BAT KY trang_thai_duyet nao) trong pham vi nhin thay cua
// SS/ASM cho thang dang chon, gom theo NV - dung cho man hinh Phe duyet de
// SS/ASM ra soat/xoa/dieu chinh bat ky dong nao cua NV, khong chi rieng cac
// dong dang "cho_duyet".
export async function layTatCaKpiTheoThang(thangDanhGia: string): Promise<ChoDuyetGroup[]> {
  await assertQuanLy();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("Chi tieu KPIs")
    .select(KPI_COLUMNS)
    .eq("thang_danh_gia", thangDanhGia)
    .order("ma_nhan_vien", { ascending: true })
    .order("chi_tieu", { ascending: true });
  if (error) throw new Error(error.message);

  return gomTheoNv((data ?? []) as ChiTieuKpiRow[]);
}

// Ten khach hang cho danh sach dong da co (hien thi "Ten (Ma)" thay vi chi
// ma) - tra ve map ma_khach -> ten_khach.
export async function layTenKhachTheoMa(maKhachList: string[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(maKhachList.filter(Boolean)));
  if (uniq.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("khach_hang_master")
    .select("ma_khach,ten_khach")
    .in("ma_khach", uniq);
  if (error) throw new Error(error.message);
  const map: Record<string, string> = {};
  for (const r of (data ?? []) as KetQuaTimKhach[]) {
    if (r.ten_khach) map[r.ma_khach] = r.ten_khach;
  }
  return map;
}
