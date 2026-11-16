import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, isDemoState } from "@/app/(site)/me/demo";
import { LAYOUT_COOKIE } from "@/app/(site)/me/layout-config";

/**
 * Ссылка на демо кабинета клиента для показа вариантов интерфейса:
 *   /demo?state=proposals&layout=3&v=2
 * state — состояние клиента (см. DEMO_STATES), layout — вариант кабинета,
 * v — вариант подборки или стартового экрана, to — раздел (/me/podbor и т. п.).
 * Вход не нужен: данные выдуманы.
 * /demo?state=off — выйти из демо.
 */
export function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const state = sp.get("state") ?? "proposals";

  if (state === "off") {
    const res = NextResponse.redirect(new URL("/", request.url));
    res.cookies.delete(DEMO_COOKIE);
    return res;
  }
  if (!isDemoState(state)) return NextResponse.redirect(new URL("/demo", request.url));

  const to = sp.get("to");
  const path = to && /^\/me(\/(podbor|vstrechi|oplaty|podderzhka))?$/.test(to) ? to : "/me";
  const target = new URL(path, request.url);
  const layout = sp.get("layout");
  const v = sp.get("v");
  if (layout) target.searchParams.set("layout", layout);
  if (v) target.searchParams.set("v", v);

  const res = NextResponse.redirect(target);
  // Сессионная кука: демо живёт, пока открыт браузер.
  res.cookies.set(DEMO_COOKIE, state, { path: "/", sameSite: "lax", httpOnly: true });
  if (layout && /^[1-5]$/.test(layout)) {
    res.cookies.set(LAYOUT_COOKIE, layout, { path: "/me", sameSite: "lax", maxAge: 31536000 });
  }
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
