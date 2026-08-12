// Cau hinh cac loai "Chi tieu" trong bang "Chi tieu KPIs" - dung chung cho
// trang xay dung KPI (NV tu nhap) va trang duyet (SS/ASM). Phai khop CHINH
// XAC voi cach workflow n8n "09a Tinh KPI..." doc du lieu (xem GHI-CHU-VAN-HANH.md
// va cac node Postgres cua workflow), vi 09a chi UPDATE cac dong da ton tai
// dung theo (chi_tieu, thang_danh_gia) - khong insert moi:
// - Code moi: chi can so_luong_khach_hang_ke_hoach + diem_kpis_ke_hoach.
// - Mo moi SPTT / Mo moi: can 1 SAN PHAM cu the (chi_tiet_ke_hoach_san_pham
//   la TEN san pham chuan hoa, khong phai ma), so_luong_khach_hang_ke_hoach
//   (so khach muc tieu) + san_luong_ke_hoach_toi_thieu (san luong toi thieu/
//   khach de duoc tinh la "dat").
// - Duy tri SPTT / Duy tri: can 1 CAP (khach hang cu the + san pham cu the),
//   san_luong_ke_hoach_toi_thieu la san luong toi thieu cua rieng cap do.
// - Doanh so kê đơn - phòng mạch / Doanh so thau: chi_tiet_ke_hoach_san_pham
//   la CHUOI SO (khong dau cham/phay) - so tien ke hoach thang.
//
// "so_luong_toi_thieu_can_dat" la NGUONG CAP NHOM (giong nhau tren moi dong
// cung 1 NV - chi_tieu - thang, da xac nhan bang du lieu thuc te) - vi du
// "can dat toi thieu 3/5 SP" de duoc 100% diem nhom - khong nhap rieng tung
// dong, xem datNguongNhom() trong build-actions.ts.
export type NhomChiTieu =
  | "so_luong_khach"
  | "so_luong_khach_co_san_pham"
  | "duy_tri_khach_cu_the"
  | "doanh_so";

export type ChiTieuConfig = {
  nhom: NhomChiTieu;
  nhan: string;
  canSanPham: boolean;
  canKhachHang: boolean;
  canSoLuongKhach: boolean;
  canSanLuongToiThieu: boolean;
  canNguongNhom: boolean;
  ghiChuMacDinh?: string;
};

export const CHI_TIEU_CONFIG: Record<string, ChiTieuConfig> = {
  "Code mới": {
    nhom: "so_luong_khach",
    nhan: "Code mới (mở mã khách hàng mới)",
    canSanPham: false,
    canKhachHang: false,
    canSoLuongKhach: true,
    canSanLuongToiThieu: false,
    canNguongNhom: false,
    ghiChuMacDinh: "Mở mã khách hàng mới",
  },
  "Mở mới SPTT": {
    nhom: "so_luong_khach_co_san_pham",
    nhan: "Mở mới SPTT",
    canSanPham: true,
    canKhachHang: false,
    canSoLuongKhach: true,
    canSanLuongToiThieu: true,
    canNguongNhom: true,
  },
  "Mở mới": {
    nhom: "so_luong_khach_co_san_pham",
    nhan: "Mở mới (sản phẩm cấp 2)",
    canSanPham: true,
    canKhachHang: false,
    canSoLuongKhach: true,
    canSanLuongToiThieu: true,
    canNguongNhom: true,
  },
  "Duy trì SPTT": {
    nhom: "duy_tri_khach_cu_the",
    nhan: "Duy trì SPTT",
    canSanPham: true,
    canKhachHang: true,
    canSoLuongKhach: false,
    canSanLuongToiThieu: true,
    canNguongNhom: true,
  },
  "Duy trì": {
    nhom: "duy_tri_khach_cu_the",
    nhan: "Duy trì (sản phẩm cấp 2)",
    canSanPham: true,
    canKhachHang: true,
    canSoLuongKhach: false,
    canSanLuongToiThieu: true,
    canNguongNhom: true,
  },
  "Doanh số kê đơn - phòng mạch": {
    nhom: "doanh_so",
    nhan: "Doanh số kê đơn - phòng mạch",
    canSanPham: false,
    canKhachHang: false,
    canSoLuongKhach: false,
    canSanLuongToiThieu: false,
    canNguongNhom: false,
  },
  "Doanh số thầu": {
    nhom: "doanh_so",
    nhan: "Doanh số thầu",
    canSanPham: false,
    canKhachHang: false,
    canSoLuongKhach: false,
    canSanLuongToiThieu: false,
    canNguongNhom: false,
  },
};

export const DANH_SACH_CHI_TIEU = Object.keys(CHI_TIEU_CONFIG);

export function layCauHinhChiTieu(chiTieu: string): ChiTieuConfig | null {
  return CHI_TIEU_CONFIG[chiTieu] ?? null;
}

export const TRANG_THAI_DUYET_LABEL: Record<string, string> = {
  nhap: "Nháp",
  cho_duyet: "Chờ duyệt",
  da_duyet: "Đã duyệt",
  tu_choi: "Từ chối",
};

export const TRANG_THAI_DUYET_TONE: Record<
  string,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  nhap: "neutral",
  cho_duyet: "warning",
  da_duyet: "success",
  tu_choi: "danger",
};
