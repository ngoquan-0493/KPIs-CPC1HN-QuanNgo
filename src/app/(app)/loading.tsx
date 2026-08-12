// Hien thi NGAY khi chuyen trang trong nhom (app) - Next.js prefetch va cache
// duoc output cua file nay cho cac route dong (dung cookies()/auth), nen bam
// vao 1 muc trong sidebar se thay skeleton nay tuc thi thay vi man hinh dung
// im cho server render xong. Khong thay the cho viec toi uu toc do truy van,
// chi giai quyet cam giac "cham" do khong co phan hoi tuc thi.
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-4 w-64 animate-pulse rounded-md bg-slate-100" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          />
        ))}
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
        <svg className="h-4 w-4 animate-spin text-slate-300" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Đang tải…
      </div>

      <div className="mt-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl border border-slate-200/80 bg-white" />
        ))}
      </div>
    </div>
  );
}
