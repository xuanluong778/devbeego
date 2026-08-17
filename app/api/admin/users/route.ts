import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/require-admin";
import { listAdminUsers, type UserFilter } from "@/lib/admin/users-service";

export const dynamic = "force-dynamic";

const FILTERS: UserFilter[] = [
  "all",
  "new",
  "activated",
  "not_activated",
  "trial",
  "paid",
  "expired",
  "inactive_7d",
];

export async function GET(request: NextRequest) {
  const admin = await requireAdminUser(request);
  if (!admin) {
    return NextResponse.json({ success: false, message: "Forbidden. Admin access only." }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const rawFilter = searchParams.get("filter") || "all";
    const filter = FILTERS.includes(rawFilter as UserFilter) ? (rawFilter as UserFilter) : "all";
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 20);
    const data = await listAdminUsers({ q, filter, page, limit });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to load users." }, { status: 500 });
  }
}
