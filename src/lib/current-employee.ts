import { createClient } from "@/lib/supabase/server";

export type Employee = {
  "Mã nhân viên": string;
  "Tên nhân viên": string;
  "Vị trí": string;
  SS: string | null;
  ASM: string | null;
  "Địa chỉ email": string | null;
};

export async function getCurrentEmployee(): Promise<Employee | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data } = await supabase
    .from("Danh sach nhan vien")
    .select(
      '"Mã nhân viên":ma_nhan_vien,"Tên nhân viên":ten_nhan_vien,"Vị trí":vi_tri,SS:ss,ASM:asm,"Địa chỉ email":dia_chi_email',
    )
    .ilike("dia_chi_email", user.email)
    .limit(1)
    .maybeSingle();

  return (data as Employee) ?? null;
}
