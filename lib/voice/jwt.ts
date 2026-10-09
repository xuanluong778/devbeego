import jwt from "jsonwebtoken";
import { getSettingSync } from "@/lib/runtime-settings/cache";

export type VoiceJwtPayload = {
  sub: string; // userId
  plan?: string;
  /** Set only for Learn-tab Call. Existing speaking tokens omit this. */
  purpose?: string;
  sid?: string;
  /** Present only after the server allowlist check. Speaking tokens omit it. */
  learnAllow?: number;
  iat?: number;
  exp?: number;
};

export function voiceJwtSecret(): string {
  const s = (getSettingSync("VOICE_JWT_SECRET") || process.env.VOICE_JWT_SECRET || "").trim();
  if (!s) {
    throw new Error("Missing VOICE_JWT_SECRET");
  }
  return s;
}

export function signVoiceJwt(payload: Omit<VoiceJwtPayload, "iat" | "exp">, ttlSeconds = 10 * 60): string {
  return jwt.sign(payload, voiceJwtSecret(), { expiresIn: ttlSeconds });
}

export function verifyVoiceJwt(token: string): VoiceJwtPayload | null {
  try {
    const decoded = jwt.verify(token, voiceJwtSecret());
    if (!decoded || typeof decoded !== "object") return null;
    const sub = "sub" in decoded ? String(decoded.sub || "").trim() : "";
    if (!sub) return null;
    const plan = "plan" in decoded ? String(decoded.plan || "").trim() : undefined;
    return { sub, plan };
  } catch {
    return null;
  }
}

