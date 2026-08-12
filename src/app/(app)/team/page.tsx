import { createClient } from "@/lib/supabase/server";
import { ghepTenMa } from "@/lib/display";
import { Card, PageHeader, EmptyState, Avatar } from "@/components/ui";
import { IconBuilding } from "@/components/icons";

type Nv = {
  "Mã nhân viên": string;
  "Tên nhân viên": string | null;
  "Vị trí": string | null;
  SS: string | null;
  "Mã SS": string | null;
  ASM: string | null;
  "Mã ASM": string | null;
  Tỉnh: string | null;
};

export default async function TeamPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("Danh sach nhan vien")
    .select(
      '"Mã nhân viên":ma_nhan_vien,"Tên nhân viên":ten_nhan_vien,"Vị trí":vi_tri,SS:ss,"Mã SS":ma_ss,ASM:asm,"Mã ASM":ma_asm,"Tỉnh":tinh',
    )
    .order("asm", { ascending: true });

  const rows = (data ?? []) as Nv[];

  // group: ASM -> SS -> [NV] - giu them ma ASM/ma SS song song voi ten de
  // hien cap Ten (Ma) o tieu de nhom, khong chi hien ten kho tra cuu.
  const tree = new Map<string, Map<string, Nv[]>>();
  const asmCodeByName = new Map<string, string | null>();
  const ssCodeByKey = new Map<string, string | null>();
  for (const r of rows) {
    if (r["Vị trí"] === "ASM") continue;
    const asmKey = r["ASM"] ?? "Chưa rõ ASM";
    const isSsRow = r["Vị trí"] === "SS";
    const ssKey = isSsRow ? `${r["Tên nhân viên"]} (SS)` : r["SS"] ?? "Chưa rõ SS";
    if (!asmCodeByName.has(asmKey)) asmCodeByName.set(asmKey, r["Mã ASM"]);
    if (!ssCodeByKey.has(ssKey)) {
      ssCodeByKey.set(ssKey, isSsRow ? r["Mã nhân viên"] : r["Mã SS"]);
    }
    if (!tree.has(asmKey)) tree.set(asmKey, new Map());
    const ssMap = tree.get(asmKey)!;
    if (!isSsRow) {
      if (!ssMap.has(ssKey)) ssMap.set(ssKey, []);
      ssMap.get(ssKey)!.push(r);
    } else if (!ssMap.has(ssKey)) {
      ssMap.set(ssKey, []);
    }
  }

  const totalNv = rows.filter((r) => r["Vị trí"] !== "ASM" && r["Vị trí"] !== "SS").length;

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <PageHeader
        title="Quản lý đội nhóm"
        description={`${totalNv} nhân viên · ${tree.size} nhóm ASM`}
      />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Lỗi tải dữ liệu: {error.message}
        </p>
      )}

      {rows.length === 0 && !error && (
        <EmptyState>Không có dữ liệu nhân sự trong phạm vi của bạn.</EmptyState>
      )}

      <div className="space-y-6">
        {[...tree.entries()].map(([asm, ssMap]) => {
          const teamSize = [...ssMap.values()].reduce((s, m) => s + m.length, 0);
          return (
            <Card key={asm}>
              <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <IconBuilding className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-slate-900">
                    ASM: {ghepTenMa(asm, asmCodeByName.get(asm))}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {ssMap.size} nhóm SS · {teamSize} nhân viên
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {[...ssMap.entries()].map(([ss, members]) => (
                  <div key={ss} className="rounded-xl bg-slate-50/70 p-3.5">
                    <p className="mb-2.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      {ghepTenMa(ss, ssCodeByKey.get(ss))}
                      <span className="text-xs font-normal text-slate-400">
                        ({members.length} NV)
                      </span>
                    </p>
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {members.map((m) => (
                        <li
                          key={m["Mã nhân viên"]}
                          className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-shadow hover:shadow-sm"
                        >
                          <Avatar name={m["Tên nhân viên"] ?? m["Mã nhân viên"]} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {ghepTenMa(m["Tên nhân viên"], m["Mã nhân viên"])}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {m["Vị trí"]} · {m["Tỉnh"] ?? "—"}
                            </p>
                          </div>
                        </li>
                      ))}
                      {members.length === 0 && (
                        <li className="text-xs text-slate-400">Chưa có NV trực thuộc</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
