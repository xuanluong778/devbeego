import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_TEXT = 180;
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 200;
/** @type {Map<string, { buf: Buffer, at: number, contentType: string }>} */
const cache = new Map();

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

function normalizeText(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT);
}

function cacheKey(lang, text) {
  return crypto.createHash("sha256").update(`${lang}|${text}`).digest("hex");
}

function pruneCache() {
  if (cache.size <= CACHE_MAX) return;
  const entries = [...cache.entries()].sort((a, b) => a[1].at - b[1].at);
  while (cache.size > CACHE_MAX - 20 && entries.length) {
    const [k] = entries.shift();
    cache.delete(k);
  }
}

async function fetchGoogleTranslateTts(text, lang) {
  const url =
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": DESKTOP_UA,
      Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`upstream_tts_${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "audio/mpeg";
  if (!contentType.includes("audio") && !contentType.includes("octet-stream")) {
    throw new Error("upstream_not_audio");
  }
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  if (buf.length < 200) throw new Error("upstream_too_small");
  return { buf, contentType: contentType.includes("audio") ? contentType : "audio/mpeg" };
}

/**
 * Same-origin English (or lang) TTS for Web + Android WebView.
 * Google Translate TTS blocks Android UA → we fetch server-side with desktop UA.
 */
export async function GET(request) {
  try {
    const rl = await checkRateLimit(request, { key: "tts_speak", windowMs: 60_000, max: 90 });
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, message: "Too many TTS requests.", code: "RATE_LIMIT" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }

    const { searchParams } = new URL(request.url);
    const text = normalizeText(searchParams.get("text") || searchParams.get("q") || "");
    const lang = String(searchParams.get("lang") || "en").trim().slice(0, 8) || "en";
    if (!text) {
      return NextResponse.json({ success: false, message: "text required" }, { status: 400 });
    }

    const key = cacheKey(lang, text);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return new NextResponse(hit.buf, {
        status: 200,
        headers: {
          "Content-Type": hit.contentType,
          "Cache-Control": "public, max-age=3600",
          "X-Beego-TTS-Cache": "HIT",
        },
      });
    }

    const { buf, contentType } = await fetchGoogleTranslateTts(text, lang);
    cache.set(key, { buf, contentType, at: Date.now() });
    pruneCache();

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "X-Beego-TTS-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("[api/tts/speak]", error?.message || error);
    return NextResponse.json(
      { success: false, message: "TTS unavailable.", code: "TTS_FAILED" },
      { status: 502 }
    );
  }
}
