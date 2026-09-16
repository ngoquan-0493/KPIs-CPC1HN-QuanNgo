import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Employee = {
  "Mã nhân viên": string;
  "Tên nhân viên": string;
  "Vị trí": string;
  SS: string | null;
  ASM: string | null;
  "Địa chỉ email": string | null;
};

// React cache() memo hoa theo TUNG REQUEST (khong phai theo user/toan cuc) -
// vi layout.tsx VA page.tsx cua nhieu trang (kpi, customers, ai-review...)
// deu tu goi getCurrentEmployee() rieng, truoc day moi request phai tra 2
// vong Supabase (auth.getUser + query "Danh sach nhan vien") NHAN 2 (hoac
// hon) vi khong duoc chia se ket qua giua layout va page trong cung 1 lan
// tai trang - gop nhau lai chi con goi 1 lan/request, giam do tre chuyen
// trang ma khong doi logic/du lieu tra ve.
export const getCurrentEmployee = cache(async (): Promise<Employee | null> => {
  const supabase = await createClient();
  // getClaims() thay cho getUser(): xac thuc JWT bang JWKS cache cuc bo khi
  // project dung asymmetric signing keys, khong phai goi mang toi Auth
  // server moi lan - giam 1 vong Ohio<->Tokyo nua so voi truoc (xem ghi chu
  // trong middleware.ts).
  const { data: claimsData } = await supabase.auth.getClaims();
  const email = claimsData?.claims?.email;
  if (!email) return null;

  const { data } = await supabase
    .from("Danh sach nhan vien")
    .select(
      '"Mã nhân viên":ma_nhan_vien,"Tên nhân viên":ten_nhan_vien,"Vị trí":vi_tri,SS:ss,ASM:asm,"Địa chỉ email":dia_chi_email',
    )
    .ilike("dia_chi_email", email)
    .limit(1)
    .maybeSingle();

  return (data as Employee) ?? null;
});
