/**
 * Capacitor Android bridge helpers — used by WebView app shell.
 * Secrets never live here; tokens go to Capacitor Preferences / Secure Storage.
 */
export function isNativeApp() {
  if (typeof window === "undefined") return false;
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

export function getNativePlatform() {
  if (!isNativeApp()) return "web";
  return window.Capacitor.getPlatform?.() || "android";
}

const ACCESS_KEY = "beego_access_token";
const REFRESH_KEY = "beego_refresh_token";

export async function saveAppTokens(access, refresh) {
  if (!isNativeApp()) {
    try {
      sessionStorage.setItem(ACCESS_KEY, access || "");
      if (refresh) sessionStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: ACCESS_KEY, value: access || "" });
    if (refresh) await Preferences.set({ key: REFRESH_KEY, value: refresh });
  } catch {
    /* plugin missing in web build */
  }
}

export async function loadAppTokens() {
  if (!isNativeApp()) {
    try {
      return {
        access: sessionStorage.getItem(ACCESS_KEY),
        refresh: sessionStorage.getItem(REFRESH_KEY),
      };
    } catch {
      return { access: null, refresh: null };
    }
  }
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const a = await Preferences.get({ key: ACCESS_KEY });
    const r = await Preferences.get({ key: REFRESH_KEY });
    return { access: a.value, refresh: r.value };
  } catch {
    return { access: null, refresh: null };
  }
}

export async function clearAppTokens() {
  await saveAppTokens("", "");
}

/** Auth-aware fetch: cookie on web, Bearer token in native app WebView. */
export async function authFetch(path, options = {}) {
  return apiFetch(path, options);
}

/** fetch wrapper: cookie on web, Bearer on Android */
export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (isNativeApp()) {
    const { access } = await loadAppTokens();
    if (access) headers.set("Authorization", `Bearer ${access}`);
  }
  return fetch(path, {
    ...options,
    headers,
    credentials: isNativeApp() ? "omit" : options.credentials ?? "same-origin",
  });
}
