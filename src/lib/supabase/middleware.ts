import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() xac thuc JWT bang JWKS cache cuc bo (khong goi mang) khi
  // project dung asymmetric signing keys, thay vi getUser() luon phai goi
  // Auth server qua mang moi request - giam 1 vong Ohio<->Tokyo tren tong
  // 3-4 vong hien co cho moi lan tai trang. Neu project chua bat asymmetric
  // keys, getClaims() se tu dong fallback ve hanh vi nhu getUser() (van goi
  // mang) nen doi ten ham khong lam hong gi, chi thuc su nhanh hon sau khi
  // bat "JWT Signing Keys" (asymmetric) trong Supabase Dashboard.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/sales";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
