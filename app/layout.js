import "./globals.css";
import "./beego-design.css";
import "./beego-learn.css";
import "./beego-lesson-player.css";
import "./beego.css";
import { Oswald, Roboto } from "next/font/google";
import AppProviders from "@/components/AppProviders";
import GuestGateProvider from "@/components/GuestGateProvider";
import AppShell from "@/components/beego/AppShell";

const roboto = Roboto({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  display: "swap",
  preload: true,
});

const oswald = Oswald({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-heading",
  preload: false,
});

export const metadata = {
  title: "Beego — Học tiếng Anh bằng AI | beego.vn",
  description:
    "Beego là nền tảng học tiếng Anh bằng AI cho mọi độ tuổi. Mobile-first, dễ dùng cho mọi người.",
  metadataBase: new URL("https://beego.vn"),
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className={`${roboto.className} ${oswald.variable}`}>
        <AppProviders>
          <GuestGateProvider>
            <AppShell>
              <div className="page-content">{children}</div>
            </AppShell>
          </GuestGateProvider>
        </AppProviders>
      </body>
    </html>
  );
}
