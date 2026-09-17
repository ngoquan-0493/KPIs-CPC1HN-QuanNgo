// Netlify Scheduled Function - giu am Next.js SSR function + middleware
// (auth check) trong gio lam viec, tranh cold start lam lan mo web dau tien
// (sau khi khong ai truy cap mot thoi gian) bi cham.
//
// Ping vao "/login" vi middleware (src/middleware.ts) ap dung cho hau het
// route tru static asset - "/login" khong can dang nhap nhung van chay dung
// qua middleware + SSR handler can duoc giu am.
//
// Lich: moi 10 phut, tu 6h sang den 21h toi gio Viet Nam (UTC+7).
// Cron cua Netlify tinh theo UTC nen 6h-21h VN = 23h (hom truoc) + 0h-13h
// (UTC), viet thanh danh sach gio "23,0-13" de tranh wrap-around qua nua dem.
const TARGET_URL = "https://asmquanden.netlify.app/login";

const handler = async () => {
  const start = Date.now();
  try {
    const res = await fetch(TARGET_URL, { method: "GET" });
    console.log(
      `[keep-warm] ping ${TARGET_URL} -> ${res.status} (${Date.now() - start}ms)`,
    );
  } catch (err) {
    console.error(`[keep-warm] ping ${TARGET_URL} failed`, err);
  }
};

export default handler;

// Khong import type "Config" tu "@netlify/functions" de khong phai them
// dependency/lockfile moi - Netlify chi doc shape { schedule } luc build.
export const config: { schedule: string } = {
  schedule: "*/10 23,0-13 * * *",
};
