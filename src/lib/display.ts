// Hien thi cap Ten (Ma) nhat quan cho NV/SS/khach hang tren moi trang, de
// ASM/SS de doi chieu voi cac he thong khac (Google Sheet, CRM, Zalo...) ma
// khong phai tu tra ten sang ma hoac nguoc lai.
//
// Quy uoc: "Ten (Ma)" neu co ca 2; chi hien 1 gia tri neu thieu ben con lai;
// "—" neu ca 2 deu trong.
export function ghepTenMa(ten: string | null | undefined, ma: string | null | undefined): string {
  const t = (ten ?? "").trim();
  const m = (ma ?? "").trim();
  if (!m) return t || "—";
  if (!t || t === m) return m;
  return `${t} (${m})`;
}

// Danh rieng cho hien thi KHACH HANG (khac NV/SS): khach vua duoc mo ma moi
// trong thang co the CHUA co ten trong he thong (nguon Google Sheet chua
// dien ten khi tao ma) - vd cac dong "Khach moi" trong chi tiet KPI Code
// moi/Mo moi/Mo moi SPTT. ghepTenMa() se chi hien tro troi ma trong truong
// hop nay, de lan voi loi hien thi that su - ham nay hien ro ly do de ASM/SS
// khong hieu nham la web bi loi.
export function hienThiKhach(ten: string | null | undefined, ma: string | null | undefined): string {
  const t = (ten ?? "").trim();
  const m = (ma ?? "").trim();
  if (!m) return t || "—";
  if (!t || t === m) return `${m} (chưa có tên khách hàng)`;
  return `${t} (${m})`;
}
