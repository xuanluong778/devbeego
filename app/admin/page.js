import { redirect } from "next/navigation";

/** Trang /admin mặc định vào quản lý học viên. */
export default function AdminIndexPage() {
  redirect("/admin/students");
}
