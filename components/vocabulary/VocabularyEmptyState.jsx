export default function VocabularyEmptyState({ filter, authRequired, onClearFilters }) {
  let title = "Không có từ vựng phù hợp";
  let desc = "Thử đổi bộ lọc hoặc tìm kiếm từ khóa khác.";
  let icon = "📭";

  if (authRequired) {
    title = "Đăng nhập để xem danh sách này";
    desc = "Bộ lọc tiến độ cá nhân cần tài khoản Beego.";
    icon = "🔐";
  } else if (filter === "saved") {
    title = "Chưa có từ bookmark";
    desc = "Bấm ☆ trên thẻ từ để lưu và ôn lại sau.";
    icon = "⭐";
  } else if (filter === "review_today") {
    title = "Không có từ cần ôn hôm nay";
    desc = "Tuyệt vời! Hãy học từ mới hoặc quay lại mai.";
    icon = "✅";
  } else if (filter === "difficult") {
    title = "Chưa có từ yếu";
    desc = "Tiếp tục học — từ hay sai sẽ hiện ở đây.";
    icon = "💪";
  } else if (filter === "mastered") {
    title = "Chưa có từ đã nhớ";
    desc = "Ôn tập SRS để ghi nhớ lâu dài.";
    icon = "🎯";
  }

  return (
    <div className="vocab-dash-empty">
      <span className="vocab-dash-empty__icon" aria-hidden>
        {icon}
      </span>
      <h2 className="vocab-dash-empty__title">{title}</h2>
      <p className="vocab-dash-empty__desc">{desc}</p>
      {authRequired ? (
        <a href="/auth?next=%2Fvocabulary" className="vocab-dash-empty__cta">
          Đăng nhập ngay
        </a>
      ) : (
        <button type="button" className="vocab-dash-empty__cta vocab-dash-empty__cta--ghost" onClick={onClearFilters}>
          Xóa bộ lọc
        </button>
      )}
    </div>
  );
}
