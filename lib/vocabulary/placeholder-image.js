/** URL ảnh placeholder / không phù hợp cho thẻ từ vựng. */
export function isPlaceholderImageUrl(url) {
  const u = String(url || "").trim().toLowerCase();
  if (!u) return true;
  return (
    u.includes("dicebear.com") ||
    u.includes("loremflickr.com") ||
    u.includes("flodjsflickr.com") ||
    u.includes("/shapes/svg") ||
    u.includes("googleusercontent.com") ||
    u.includes("gstatic.com/images") ||
    u.includes("images.google.")
  );
}
