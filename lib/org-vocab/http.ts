import { NextResponse } from "next/server";

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function jsonErr(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

export function mapServiceError(error: unknown) {
  const msg = error instanceof Error ? error.message : "UNKNOWN";
  if (msg === "FORBIDDEN" || msg === "FORBIDDEN_SET") {
    return jsonErr("Bạn không có quyền thực hiện thao tác này.", 403);
  }
  if (msg === "NOT_FOUND" || msg === "SESSION_NOT_FOUND") {
    return jsonErr("Không tìm thấy dữ liệu.", 404);
  }
  if (msg === "INVALID_NAME" || msg === "INVALID_TITLE" || msg === "INVALID_USER") {
    return jsonErr("Dữ liệu không hợp lệ.", 400);
  }
  if (msg === "EMPTY_WORDS") {
    return jsonErr("Không có từ hợp lệ để import.", 400);
  }
  const detail =
    process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
  return jsonErr(`Lỗi xử lý.${detail}`.trim(), 500);
}
