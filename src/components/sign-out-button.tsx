"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconLogout } from "@/components/icons";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700"
    >
      <IconLogout className="h-4 w-4" />
      Đăng xuất
    </button>
  );
}
