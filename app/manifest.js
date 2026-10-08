export default function manifest() {
  return {
    name: "Beego — Học tiếng Anh",
    short_name: "Beego",
    description: "Học tiếng Anh bằng AI trên beego.vn",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#ffb020",
    lang: "vi",
    icons: [
      {
        src: "/icons/beego-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/beego-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/beego-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
