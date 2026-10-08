import InstallAppOffer from "@/components/beego/InstallAppOffer";

export const metadata = {
  title: "Cài ứng dụng Beego | beego.vn",
  description: "Tải Beego cho Android hoặc thêm Beego vào Màn hình chính trên iPhone.",
};

export default function CaiDatAppPage() {
  return (
    <div className="beego-install-page">
      <InstallAppOffer variant="page" />
    </div>
  );
}
