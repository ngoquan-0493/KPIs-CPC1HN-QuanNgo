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
