import AdminGuard from "@/components/admin/AdminGuard";
import "./admin.css";

export default function AdminLayout({ children }) {
  return (
    <AdminGuard>
      <div className="adm-root">{children}</div>
    </AdminGuard>
  );
}
