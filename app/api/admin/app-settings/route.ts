import { NextResponse, type NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireSystemOwner } from "@/lib/admin/require-admin";
import { encryptSettingValue, getMasterSecret, hasMasterSecret } from "@/lib/runtime-settings/crypto";
import {
  warmRuntimeSettingsCache,
  clearRuntimeSettingsCache,
  getSettingSync,
} from "@/lib/runtime-settings/cache";
import { ensureAppSettingsTable } from "@/lib/runtime-settings/table";
import { MANAGED_KEY_SET, MANAGED_SETTING_KEYS } from "@/lib/runtime-settings/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function defForKey(key: string) {
  return MANAGED_SETTING_KEYS.find((d) => d.key === key);
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireSystemOwner(request);
    if (admin instanceof NextResponse) return admin;
    if (!admin) {
      return NextResponse.json({ success: false, message: "Forbidden. Admin access only." }, { status: 403 });
    }

    await ensureAppSettingsTable();
    await warmRuntimeSettingsCache();
    const [dbRows] = await pool.query("SELECT setting_key FROM app_settings");
    const inDb = new Set((dbRows as { setting_key: string }[]).map((r) => r.setting_key));

    const items = MANAGED_SETTING_KEYS.map((def) => {
      const fromEnv = process.env[def.key];
      const hasRow = inDb.has(def.key);
      const effective = getSettingSync(def.key) ?? "";
      let hint: string;
      if (def.secret) {
        if (hasRow) hint = "Đã lưu trong database (mã hóa khi có APP_SETTINGS_SECRET).";
        else if (fromEnv && String(fromEnv).trim()) hint = "Đang lấy từ .env.";
        else hint = "Chưa cấu hình.";
      } else {
        hint = hasRow ? "Giá trị trong DB ghi đè .env sau khi load cache." : "Chỉ .env nếu chưa lưu DB.";
      }
      return {
        key: def.key,
        label: def.label,
        group: def.group,
        secret: def.secret,
        placeholder: def.placeholder || "",
        storedInDatabase: hasRow,
        hint,
        valueForForm: def.secret ? "" : String(effective),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        items,
        encryptionEnabled: hasMasterSecret(),
        note:
          "Kết nối MySQL (DATABASE_URL / DB_*) và ADMIN_EMAIL, APP_SETTINGS_SECRET chỉ đặt trong .env trên server — không lưu trong bảng này.",
      },
    });
  } catch (err) {
    console.error("[admin/app-settings] GET", err);
    return NextResponse.json({ success: false, message: "Failed to load settings." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireSystemOwner(request);
    if (admin instanceof NextResponse) return admin;
    if (!admin) {
      return NextResponse.json({ success: false, message: "Forbidden. Admin access only." }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: "Invalid JSON." }, { status: 400 });
    }

    const entries = (body as { settings?: Record<string, unknown> })?.settings;
    if (!entries || typeof entries !== "object") {
      return NextResponse.json({ success: false, message: "settings object required." }, { status: 400 });
    }

    await ensureAppSettingsTable();
    const master = getMasterSecret();

    for (const [rawKey, rawVal] of Object.entries(entries)) {
      if (!MANAGED_KEY_SET.has(rawKey)) continue;
      const def = defForKey(rawKey);
      if (!def) continue;

      if (rawVal === null || rawVal === undefined) continue;

      const strVal = typeof rawVal === "string" ? rawVal : String(rawVal);
      const trimmed = strVal.trim();

      if (trimmed === "") {
        await pool.query("DELETE FROM app_settings WHERE setting_key = ?", [rawKey]);
        continue;
      }

      const useEncryption = Boolean(def.secret && master);
      let stored = trimmed;
      let isEncrypted = 0;
      if (useEncryption && master) {
        stored = encryptSettingValue(trimmed, master);
        isEncrypted = 1;
      }

      await pool.query(
        `INSERT INTO app_settings (setting_key, setting_value, is_encrypted)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), is_encrypted = VALUES(is_encrypted)`,
        [rawKey, stored, isEncrypted]
      );
    }

    clearRuntimeSettingsCache();
    await warmRuntimeSettingsCache();

    return NextResponse.json({
      success: true,
      message: "Đã cập nhật cấu hình. Server đang dùng giá trị từ database (ưu tiên hơn .env sau khi load cache).",
    });
  } catch (err) {
    console.error("[admin/app-settings] POST", err);
    return NextResponse.json({ success: false, message: "Failed to save settings." }, { status: 500 });
  }
}
