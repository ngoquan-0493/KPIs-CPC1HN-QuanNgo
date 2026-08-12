import { getCurrentEmployee } from "@/lib/current-employee";
import SignOutButton from "@/components/sign-out-button";
import NavLinks from "@/components/nav-links";
import { Avatar } from "@/components/ui";
import { IconSparkles } from "@/components/icons";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const employee = await getCurrentEmployee();

  if (!employee) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
          <p className="font-semibold text-amber-900">
            Tài khoản này chưa được gán vào danh sách nhân viên.
          </p>
          <p className="mt-2 text-sm text-amber-800">
            Email đăng nhập của bạn không khớp với cột &quot;Địa chỉ email&quot; trong bảng
            &quot;Danh sach nhan vien&quot;. Liên hệ quản trị viên để cập nhật.
          </p>
          <div className="mt-4">
            <SignOutButton />
          </div>
        </div>
      </div>
    );
  }

  const employeeName = employee["Tên nhân viên"] ?? "Người dùng";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Sidebar desktop - an hoan toan tren man hinh nho hon lg (dien thoai/
          tablet doc), thay bang top bar + bottom nav ben duoi. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur-sm lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-800 to-blue-600 text-white shadow-sm">
            <IconSparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">Bán hàng &amp; KPI</p>
            <p className="truncate text-[11px] text-slate-400">Sales performance hub</p>
          </div>
        </div>

        <NavLinks viTri={employee["Vị trí"]} />

        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
            <Avatar name={employeeName} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{employeeName}</p>
              <p className="truncate text-xs text-slate-400">{employee["Vị trí"]}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Top bar dien thoai - thay the phan header/avatar cua sidebar khi
          sidebar bi an. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-sm lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-800 to-blue-600 text-white shadow-sm">
            <IconSparkles className="h-4 w-4" />
          </span>
          <p className="truncate text-sm font-semibold text-slate-900">Bán hàng &amp; KPI</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Avatar name={employeeName} className="h-8 w-8" />
          <SignOutButton compact />
        </div>
      </header>

      {/* pb-20: chua khong gian cho bottom nav co dinh tren dien thoai, tranh
          che noi dung cuoi trang. */}
      <main className="min-w-0 flex-1 overflow-x-hidden pb-20 lg:pb-0">{children}</main>

      <NavLinks viTri={employee["Vị trí"]} variant="bottom" />
    </div>
  );
}
