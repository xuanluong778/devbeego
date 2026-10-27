import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LISTENING_PATH } from "@/lib/beego/routes";
import { assertMutationOrigin } from "@/lib/security/csrf-origin";
import { checkIpRateLimit } from "@/lib/security/ip-rate-limit";

const SESSION_COOKIE = "session_token";

/** Trang & API chỉ đọc nội dung học — không cần đăng nhập (API nhạy cảm vẫn tự kiểm tra session bên trong). */
function isPublicPath(pathname: string): boolean {
  if (pathname === "/auth" || pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/.well-known/assetlinks.json") return true;
  if (pathname === "/api/billing/webhook") return true;
  if (pathname === "/api/payments/sepay/ipn") return true;
  if (pathname.startsWith("/billing/sepay")) return true;
  // Mọi route kiểm tra sức khỏe (kể cả /api/health/db) — tránh VPS bản cũ sót từng path.
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/uploads/")) return true;
  if (
    pathname === "/downloads/beego.apk" ||
    pathname.startsWith("/downloads/") ||
    pathname.startsWith("/icons/")
  ) {
    return true;
  }
  if (/\.(?:ico|png|jpg|jpeg|gif|webp|svg|txt|xml|json|webmanifest|apk|zip|woff2?)$/i.test(pathname)) {
    return true;
  }
  if (pathname === "/" || pathname === "/quiz" || pathname === "/pronunciation" || pathname === LISTENING_PATH) {
    return true;
  }
  if (
    pathname === "/vocabulary" ||
    pathname === "/dictionary" ||
    pathname.startsWith("/kids-learn-vocabulary") ||
    pathname.startsWith("/kids-fun-stories") ||
    pathname.startsWith("/kids") ||
    pathname.startsWith("/stories")
  ) {
    return true;
  }
  if (pathname === "/onboarding" || pathname.startsWith("/tracks/")) {
    return true;
  }
  if (pathname === "/progress" || pathname === "/account" || pathname === "/cai-dat-app") {
    return true;
  }
  return false;
}

function isPublicApiPath(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  if (pathname === "/api/lessons") {
    return m === "GET" || m === "HEAD" || m === "OPTIONS";
  }
  if (pathname.startsWith("/api/vocabulary")) {
    return m === "GET" || m === "HEAD" || m === "OPTIONS";
  }
  if (pathname.startsWith("/api/dictionary/")) return true;
  if (pathname === "/api/quiz" || pathname.startsWith("/api/quiz/")) return true;
  if (pathname === "/api/listening/clips" || pathname.startsWith("/api/listening/")) return true;
  if (pathname === "/api/ai-call/teacher-speech") {
    return m === "POST" || m === "OPTIONS";
  }
  // Same-origin TTS for Web + Android WebView (Google UA blocks mobile clients).
  if (pathname === "/api/tts/speak" || pathname.startsWith("/api/tts/")) {
    return m === "GET" || m === "HEAD" || m === "OPTIONS";
  }
  return false;
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Cookie-session API nhạy cảm: CSRF + rate limit nhẹ tại edge (per instance). */
function isStaffOrBillingMutationPath(pathname: string, method: string): boolean {
  if (!MUTATION_METHODS.has(method.toUpperCase())) return false;
  if (pathname.startsWith("/api/admin/")) return true;
  if (pathname.startsWith("/api/org/")) return true;
  if (pathname === "/api/payments/create") return true;
  if (pathname.startsWith("/api/billing/checkout")) return true;
  return false;
}

function isStaffReadPath(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  if (m !== "GET" && m !== "HEAD") return false;
  return pathname.startsWith("/api/admin/") || pathname.startsWith("/api/org/");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if (pathname === "/memory") {
    const url = request.nextUrl.clone();
    url.pathname = "/pronunciation";
    return NextResponse.redirect(url);
  }

  if (pathname === "/matching") {
    const url = request.nextUrl.clone();
    url.pathname = "/quiz";
    return NextResponse.redirect(url);
  }

  if (pathname === "/lessons" || pathname.startsWith("/lessons/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/lessons(?=\/|$)/, "/luyen-noi");
    return NextResponse.redirect(url);
  }

  if (pathname === "/listening" || pathname.startsWith("/listening/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/listening(?=\/|$)/, LISTENING_PATH);
    return NextResponse.redirect(url);
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Learning path catalog readable without auth; mutations still require session inside route
  if (pathname === "/api/learning-path" && (method === "GET" || method === "HEAD" || method === "OPTIONS")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (isPublicApiPath(pathname, method)) {
      return NextResponse.next();
    }

    if (isStaffOrBillingMutationPath(pathname, method)) {
      const csrf = assertMutationOrigin(request);
      if (!csrf.ok) {
        return NextResponse.json(
          { success: false, message: csrf.message, code: csrf.code },
          { status: 403 }
        );
      }
    }

    if (isStaffOrBillingMutationPath(pathname, method) || isStaffReadPath(pathname, method)) {
      const mutation = isStaffOrBillingMutationPath(pathname, method);
      const rl = checkIpRateLimit(request, {
        key: mutation ? "edge:staff-mutation" : "edge:staff-read",
        windowMs: 60_000,
        max: Number(
          mutation
            ? process.env.EDGE_ADMIN_MUTATION_RATE_MAX || 90
            : process.env.EDGE_ADMIN_READ_RATE_MAX || 240
        ),
      });
      if (!rl.ok) {
        return NextResponse.json(
          { success: false, message: "Too many requests.", code: "RATE_LIMIT" },
          {
            status: 429,
            headers: rl.retryAfterSec ? { "Retry-After": String(rl.retryAfterSec) } : undefined,
          }
        );
      }
    }

    // Auth validated per route (cookie or Bearer via getSessionUserFromRequest).
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Khớp mọi path trừ toàn bộ /_next/* (static, image, flight, HMR…) — tránh middleware chạm request chunk JS/CSS.
  matcher: ["/((?!_next/).*)"],
};
