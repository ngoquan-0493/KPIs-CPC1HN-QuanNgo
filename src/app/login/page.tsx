"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconSparkles } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Email hoặc mật khẩu không đúng.");
      return;
    }
    router.push("/sales");
    router.refresh();
  }

  const inputClass =
    "mb-4 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15";

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)]"
      >
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-800 to-blue-600 text-white shadow-sm">
          <IconSparkles className="h-5 w-5" />
        </span>
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-slate-900">Đăng nhập</h1>
        <p className="mb-6 text-sm text-slate-500">Hệ thống theo dõi bán hàng &amp; KPI</p>

        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="ten@congty.com"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">Mật khẩu</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="••••••••"
        />

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-blue-800 to-blue-700 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
