import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/org-vocab/access";
import { jsonOk, jsonErr, mapServiceError } from "@/lib/org-vocab/http";
import { listStudentAssignments } from "@/lib/org-vocab/service";

export const dynamic = "force-dynamic";

/** Bài tập được giao cho học viên — không ảnh hưởng thư viện từ cá nhân. */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) {
      return jsonOk({ authenticated: false, assignments: [] });
    }
    const assignments = await listStudentAssignments(auth);
    return jsonOk({
      authenticated: true,
      assignments,
    });
  } catch (error) {
    return mapServiceError(error);
  }
}
