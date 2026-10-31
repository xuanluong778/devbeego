"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listSpeakingTabTopics } from "@/lib/beego/learn/ai-call-access";
import { loadLearningPath } from "@/lib/beego/learning-path";
import LearnLessonCall from "@/components/beego/lesson-player/LearnLessonCall";
import { LearnCallRobotFace } from "@/components/beego/lesson-player/LearnCallCharacter";

/** Topic visual presets: icon, short prompt description, theme styling */
const TOPIC_PRESETS = {
  1: { icon: "🤝", desc: "Tập chào hỏi, giới thiệu bản thân & làm quen bạn mới", bg: "#ecfdf5", border: "#a7f3d0" },
  2: { icon: "🪪", desc: "Hỏi và trả lời về họ tên, tuổi tác, quê quán & quốc tịch", bg: "#eff6ff", border: "#bfdbfe" },
  3: { icon: "👨‍👩‍👧‍👦", desc: "Giới thiệu các thành viên trong gia đình & tính cách", bg: "#fff1f2", border: "#fecdd3" },
  4: { icon: "⏰", desc: "Nói về giờ giấc, lịch hẹn & các con số thực tế", bg: "#fffbeb", border: "#fde68a" },
  5: { icon: "🎒", desc: "Gọi tên đồ dùng học tập, lớp học & vật dụng quen thuộc", bg: "#faf5ff", border: "#e9d5ff" },
  6: { icon: "🏡", desc: "Mô tả ngôi nhà, các phòng & vị trí đồ đạc xung quanh", bg: "#f0fdfa", border: "#99f6e4" },
  7: { icon: "☀️", desc: "Kể về lịch trình sinh hoạt hằng ngày từ sáng tới tối", bg: "#fff7ed", border: "#fed7aa" },
  8: { icon: "🍕", desc: "Gọi món ăn, đồ uống & chia sẻ sở thích ẩm thực", bg: "#fef2f2", border: "#fecaca" },
  9: { icon: "🛍️", desc: "Hỏi giá cả, mặc cả, chọn kích cỡ & mua sắm đồ dùng", bg: "#fdf2f8", border: "#fbcfe8" },
  10: { icon: "🚗", desc: "Hỏi đường, chỉ hướng & lựa chọn phương tiện giao thông", bg: "#eef2ff", border: "#c7d2fe" },
  11: { icon: "⛅", desc: "Trò chuyện về dự báo thời tiết, các mùa & trang phục", bg: "#ecfeff", border: "#a5f3fc" },
  12: { icon: "🎮", desc: "Chia sẻ sở thích cá nhân, âm nhạc, phim ảnh & cuối tuần", bg: "#f5f3ff", border: "#ddd6fe" },
  13: { icon: "🏃‍♂️", desc: "Thói quen rèn luyện thể thao & duy trì lối sống lành mạnh", bg: "#ecfdf5", border: "#a7f3d0" },
  14: { icon: "🎉", desc: "Đưa ra lời mời đi chơi, hẹn hò & tham gia sự kiện", bg: "#fffbeb", border: "#fde68a" },
  15: { icon: "📱", desc: "Nghe gọi điện thoại, nhắn tin & trao đổi thông tin số", bg: "#eff6ff", border: "#bfdbfe" },
  16: { icon: "🎓", desc: "Nói về trường lớp, phương pháp học tập & môn học yêu thích", bg: "#eef2ff", border: "#c7d2fe" },
  17: { icon: "💼", desc: "Nghề nghiệp, công việc hằng ngày & môi trường công sở", bg: "#f0f9ff", border: "#bae6fd" },
  18: { icon: "✈️", desc: "Du lịch, đặt phòng khách sạn & làm thủ tục sân bay", bg: "#eff6ff", border: "#bfdbfe" },
  19: { icon: "🍽️", desc: "Trải nghiệm tại nhà hàng, nhận xét món ăn & phục vụ", bg: "#fffbeb", border: "#fde68a" },
  20: { icon: "📦", desc: "Đặt hàng trực tuyến, giao nhận & thanh toán điện tử", bg: "#fff7ed", border: "#fed7aa" },
  21: { icon: "🏘️", desc: "Thuê căn hộ, tiện ích cư dân & giao tiếp với hàng xóm", bg: "#f0fdfa", border: "#99f6e4" },
  22: { icon: "📖", desc: "Kể lại một chuyến đi, kỷ niệm đáng nhớ hoặc câu chuyện xưa", bg: "#fff1f2", border: "#fecdd3" },
  23: { icon: "🎯", desc: "Lập kế hoạch tuần mới, mục tiêu tương lai & ước mơ", bg: "#faf5ff", border: "#e9d5ff" },
  24: { icon: "🏮", desc: "Khám phá các phong tục tập quán & lễ hội truyền thống", bg: "#fef2f2", border: "#fecaca" },
  25: { icon: "❤️", desc: "Hoạt động xã hội, tình nguyện & sẻ chia cùng cộng đồng", bg: "#fff1f2", border: "#fecdd3" },
  26: { icon: "💬", desc: "Bày tỏ cảm xúc vui buồn, thấu hiểu & xây dựng tình bạn", bg: "#fdf2f8", border: "#fbcfe8" },
  27: { icon: "🌱", desc: "Bảo vệ môi trường tự nhiên, phân loại rác & sống xanh", bg: "#ecfdf5", border: "#a7f3d0" },
  28: { icon: "🏆", desc: "Ôn tập tổng kết kỹ năng sống & thực hiện dự án thực tế", bg: "#fffbeb", border: "#fde68a" },
  29: { icon: "👔", desc: "Mô phỏng phỏng vấn xin việc & giới thiệu kinh nghiệm bản thân", bg: "#eff6ff", border: "#bfdbfe" },
  30: { icon: "📧", desc: "Giao tiếp email trang trọng & xử lý công việc văn phòng", bg: "#eef2ff", border: "#c7d2fe" },
  31: { icon: "👥", desc: "Thảo luận nhóm, trình bày ý kiến & biểu quyết trong cuộc họp", bg: "#f5f3ff", border: "#ddd6fe" },
  32: { icon: "🎤", desc: "Thuyết trình chuyên đề, dẫn dắt câu chuyện & thuyết phục người nghe", bg: "#faf5ff", border: "#e9d5ff" },
  33: { icon: "🎧", desc: "Hỗ trợ khách hàng, lắng nghe phản ánh & tư vấn giải pháp", bg: "#f0f9ff", border: "#bae6fd" },
  34: { icon: "💻", desc: "Công nghệ số, thiết bị thông minh & bảo mật thông tin", bg: "#ecfeff", border: "#a5f3fc" },
  35: { icon: "💳", desc: "Quản lý chi tiêu cá nhân, tiết kiệm & quyết định tài chính", bg: "#ecfdf5", border: "#a7f3d0" },
  36: { icon: "📰", desc: "Bình luận tin tức thời sự, truyền thông báo chí & xu hướng", bg: "#fff7ed", border: "#fed7aa" },
  37: { icon: "🔬", desc: "Khoa học đời sống, khám phá không gian & phát minh mới", bg: "#eff6ff", border: "#bfdbfe" },
  38: { icon: "🩺", desc: "Y tế cộng đồng, phòng chống dịch bệnh & bảo vệ sức khỏe", bg: "#f0fdfa", border: "#99f6e4" },
  39: { icon: "📚", desc: "Đọc tài liệu chuyên sâu, phân tích dữ liệu & viết học thuật", bg: "#eef2ff", border: "#c7d2fe" },
  40: { icon: "🤝", desc: "Đàm phán điều khoản hợp đồng & nghệ thuật thương lượng", bg: "#fffbeb", border: "#fde68a" },
  41: { icon: "📊", desc: "Quản lý tiến độ dự án, dự trù ngân sách & kiểm soát thay đổi", bg: "#faf5ff", border: "#e9d5ff" },
  42: { icon: "🌍", desc: "Giao lưu văn hóa quốc tế & thích ứng môi trường đa quốc gia", bg: "#f0fdfa", border: "#99f6e4" },
  43: { icon: "🎨", desc: "Thưởng thức nghệ thuật, phê bình phim ảnh & triển lãm", bg: "#fdf2f8", border: "#fbcfe8" },
  44: { icon: "🏛️", desc: "Tìm hiểu các mốc lịch sử lớn & những chuyển biến xã hội", bg: "#fffbeb", border: "#fde68a" },
  45: { icon: "⚖️", desc: "Đạo đức nghề nghiệp, trách nhiệm xã hội & các chuẩn mực", bg: "#eef2ff", border: "#c7d2fe" },
  46: { icon: "🌲", desc: "Biến đổi khí hậu, năng lượng sạch & phát triển bền vững", bg: "#ecfdf5", border: "#a7f3d0" },
  47: { icon: "🤖", desc: "Trí tuệ nhân tạo (AI), tự động hóa & tương lai việc làm", bg: "#faf5ff", border: "#e9d5ff" },
  48: { icon: "💡", desc: "Tranh biện quan điểm, tư duy phản biện & lập luận sắc bén", bg: "#fffbeb", border: "#fde68a" },
  49: { icon: "📜", desc: "Nghiên cứu học thuật, xây dựng luận điểm & bảo vệ công trình", bg: "#eff6ff", border: "#bfdbfe" },
  50: { icon: "🎓", desc: "Bảo vệ dự án tổng kết, hoàn thiện hồ sơ & mở ra chặng đường mới", bg: "#fefce8", border: "#fef08a" },
};

function getTopicVisual(gateNumber, title) {
  if (TOPIC_PRESETS[gateNumber]) return TOPIC_PRESETS[gateNumber];
  const t = (title || "").toLowerCase();
  if (t.includes("chào") || t.includes("làm quen")) return { icon: "🤝", desc: "Tập chào hỏi & làm quen bạn mới", bg: "#ecfdf5", border: "#a7f3d0" };
  if (t.includes("ăn") || t.includes("uống")) return { icon: "🍕", desc: "Gọi món & sở thích ẩm thực", bg: "#fef2f2", border: "#fecaca" };
  if (t.includes("mua") || t.includes("giá")) return { icon: "🛍️", desc: "Mua sắm & hỏi giá cả", bg: "#fdf2f8", border: "#fbcfe8" };
  if (t.includes("thời gian") || t.includes("số")) return { icon: "⏰", desc: "Nói về thời gian & con số", bg: "#fffbeb", border: "#fde68a" };
  if (t.includes("gia đình")) return { icon: "👨‍👩‍👧‍👦", desc: "Trò chuyện về gia đình", bg: "#fff1f2", border: "#fecdd3" };
  return { icon: "🎙️", desc: "Luyện phản xạ giao tiếp cùng gia sư AI", bg: "#f5f3ff", border: "#ddd6fe" };
}

/**
 * Tab Luyện nói (/luyen-noi): Sinh động, kích thích phản xạ giao tiếp với Gia sư AI.
 * Reuses Learn Lesson Call engine while providing an inspiring, gamified topic showcase.
 */
export default function LearnCallSpeakingTab() {
  const [loading, setLoading] = useState(true);
  const [featureOn, setFeatureOn] = useState(false);
  const [topics, setTopics] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'open' | 'locked'

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const [statusRes, pathRes] = await Promise.all([
          fetch("/api/learn/ai-call/status", { cache: "no-store", credentials: "same-origin" }),
          fetch("/api/learning-path", { cache: "no-store", credentials: "same-origin" }),
        ]);
        const statusJson = await statusRes.json().catch(() => ({}));
        const pathJson = await pathRes.json().catch(() => ({}));
        if (cancel) return;
        setFeatureOn(Boolean(statusJson?.data?.enabled));
        const path = loadLearningPath(pathRes.ok && pathJson?.success ? pathJson.data : null);
        setTopics(listSpeakingTabTopics(path));
        setSelected(null);
      } catch {
        if (!cancel) setLoadError("Không tải được lộ trình học. Hãy thử lại.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const openCount = useMemo(() => topics.filter((item) => !item.locked).length, [topics]);

  const filteredTopics = useMemo(() => {
    return topics.filter((item) => {
      // Tab filter
      if (filterTab === "open" && item.locked) return false;
      if (filterTab === "locked" && !item.locked) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const title = (item.topicTitle || item.sectionId || "").toLowerCase();
        const goal = (item.targetGoal || "").toLowerCase();
        const gate = `cửa ${item.curriculumGateNumber || ""}`.toLowerCase();
        if (!title.includes(query) && !goal.includes(query) && !gate.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [topics, filterTab, searchQuery]);

  if (loading) {
    return (
      <div className="beego-learn-call-tab" role="status">
        <div className="beego-speaking-loading-box">
          <span className="beego-speaking-loading-mascot" aria-hidden="true">🐝</span>
          <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#1e1b4b" }}>
            Đang chuẩn bị phòng Luyện nói cùng Gia sư AI…
          </h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
            Hệ thống đang tải danh sách các chủ đề hội thoại sinh động cho bạn.
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="beego-learn-call-tab" role="alert">
        <div className="beego-speaking-empty">
          <span className="beego-speaking-empty-icon" aria-hidden="true">⚠️</span>
          <h3>{loadError}</h3>
          <p>Có thể kết nối mạng bị gián đoạn. Hãy nhấn thử lại để tiếp tục học.</p>
          <button type="button" className="beego-speaking-empty-btn" onClick={() => window.location.reload()}>
            Thử lại ngay
          </button>
        </div>
      </div>
    );
  }

  if (!featureOn) {
    return (
      <div className="beego-learn-call-tab" role="status">
        <div className="beego-speaking-empty">
          <span className="beego-speaking-empty-icon" aria-hidden="true">🎙️</span>
          <h3>Tính năng gọi gia sư AI chưa mở</h3>
          <p>Tính năng luyện nói cùng gia sư AI chưa kích hoạt trên tài khoản này.</p>
          <Link href="/" className="beego-speaking-empty-btn" style={{ textDecoration: "none" }}>
            Về trang Bản đồ Học
          </Link>
        </div>
      </div>
    );
  }

  if (!topics.length) {
    return (
      <div className="beego-learn-call-tab" role="status">
        <div className="beego-speaking-empty">
          <span className="beego-speaking-empty-icon" aria-hidden="true">🗺️</span>
          <h3>Chưa có chủ đề trên lộ trình học</h3>
          <p>Hãy vào bản đồ Học để bắt đầu hành trình và mở khóa các chủ đề luyện nói.</p>
          <Link href="/" className="beego-speaking-empty-btn" style={{ textDecoration: "none" }}>
            Vào bản đồ Học
          </Link>
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="beego-learn-call-tab" role="region" aria-label="Chọn chủ đề gọi gia sư AI">
        <div className="beego-learn-call-tab__picker">
          {/* Hero Banner: Inspiring & Vibrant */}
          <section className="beego-speaking-hero" aria-labelledby="speaking-hero-title">
            <div className="beego-speaking-hero__badges">
              <span className="beego-speaking-badge-live">
                <span className="beego-speaking-pulse-dot" aria-hidden="true" />
                Gia sư AI 1:1 • Trực tuyến 24/7
              </span>
              <span className="beego-speaking-badge-sub">⚡ Tự tin phản xạ</span>
            </div>

            <div className="beego-speaking-hero__main">
              <div className="beego-speaking-hero__content">
                <h1 id="speaking-hero-title" className="beego-speaking-hero__title">
                  Luyện Nói Cùng Gia Sư AI
                </h1>
                <p className="beego-speaking-hero__desc">
                  Thực hành hội thoại 1:1 theo từng chủ đề bài học. Gia sư AI kiên nhẫn lắng nghe, sửa phát âm và đồng hành giúp bạn giao tiếp tự nhiên không sợ sai!
                </p>
              </div>

              <div className="beego-speaking-hero__avatar-box" aria-hidden="true">
                <LearnCallRobotFace className="beego-speaking-hero__avatar-icon" />
                <div className="beego-speaking-soundwaves">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>

            <div className="beego-speaking-hero__stats">
              <div className="beego-speaking-stat-pill">
                <span className="beego-speaking-stat-label">Chủ đề sẵn sàng</span>
                <span className="beego-speaking-stat-value">{openCount} / {topics.length}</span>
              </div>
              <div className="beego-speaking-stat-pill">
                <span className="beego-speaking-stat-label">Thời lượng gợi ý</span>
                <span className="beego-speaking-stat-value">2–3 phút / lượt</span>
              </div>
              <div className="beego-speaking-stat-pill">
                <span className="beego-speaking-stat-label">Hỗ trợ thông minh</span>
                <span className="beego-speaking-stat-value">Sửa phát âm tức thì</span>
              </div>
            </div>
          </section>

          {/* Search & Filter Toolbar */}
          <div className="beego-speaking-toolbar">
            <div className="beego-speaking-search-wrap">
              <span className="beego-speaking-search-icon" aria-hidden="true">🔍</span>
              <input
                type="search"
                className="beego-speaking-search-input"
                placeholder="Tìm chủ đề (ví dụ: chào hỏi, mua sắm, gia đình, giờ giấc…)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm kiếm chủ đề bài học"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="beego-speaking-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Xóa tìm kiếm"
                >
                  ✕
                </button>
              ) : null}
            </div>

            <div className="beego-speaking-filter-chips" role="tablist" aria-label="Bộ lọc chủ đề">
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === "all"}
                className={`beego-speaking-filter-chip${filterTab === "all" ? " is-active" : ""}`}
                onClick={() => setFilterTab("all")}
              >
                Tất cả ({topics.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === "open"}
                className={`beego-speaking-filter-chip${filterTab === "open" ? " is-active" : ""}`}
                onClick={() => setFilterTab("open")}
              >
                🟢 Đã mở ({openCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterTab === "locked"}
                className={`beego-speaking-filter-chip${filterTab === "locked" ? " is-active" : ""}`}
                onClick={() => setFilterTab("locked")}
              >
                🔒 Chưa mở ({topics.length - openCount})
              </button>
            </div>
          </div>

          {/* Section Heading */}
          <div className="beego-speaking-section-header">
            <h2 className="beego-learn-call-tab__title">Chủ đề luyện tập</h2>
            <span className="beego-speaking-count-badge">
              Hiển thị {filteredTopics.length} chủ đề
            </span>
          </div>

          {/* Topics Grid */}
          {filteredTopics.length === 0 ? (
            <div className="beego-speaking-empty">
              <span className="beego-speaking-empty-icon" aria-hidden="true">🔍</span>
              <h3>Không tìm thấy chủ đề phù hợp</h3>
              <p>Không có chủ đề nào khớp với từ khóa “{searchQuery}”. Hãy thử tìm từ khóa khác nhé!</p>
              <button
                type="button"
                className="beego-speaking-empty-btn"
                onClick={() => {
                  setSearchQuery("");
                  setFilterTab("all");
                }}
              >
                Xem tất cả chủ đề
              </button>
            </div>
          ) : (
            <ul className="beego-learn-call-tab__topics">
              {filteredTopics.map((item) => {
                const locked = Boolean(item.locked);
                const gateNum = item.curriculumGateNumber || 1;
                const visual = getTopicVisual(gateNum, item.topicTitle);
                const displayTitle = item.topicTitle || item.sectionId;

                return (
                  <li key={item.sectionId}>
                    <button
                      type="button"
                      className={locked ? "beego-learn-call-tab__topic--locked" : undefined}
                      disabled={locked}
                      aria-disabled={locked}
                      aria-label={
                        locked
                          ? `${displayTitle} — chưa mở trên bản đồ Học`
                          : `${displayTitle} — nhấn để gọi gia sư AI`
                      }
                      onClick={() => {
                        if (locked || !item.lessonId) return;
                        setSelected(item);
                      }}
                    >
                      {/* Top Meta: Gate, Level, Status */}
                      <div className="beego-speaking-card__top">
                        <div className="beego-speaking-card__tags">
                          <span className="beego-speaking-gate-tag">Cửa {gateNum}</span>
                          {item.level ? (
                            <span className="beego-speaking-level-tag">{item.level}</span>
                          ) : null}
                        </div>
                        {locked ? (
                          <span className="beego-learn-call-tab__topic-state">🔒 Chưa mở</span>
                        ) : (
                          <span className="beego-speaking-status-ready">
                            <span className="beego-speaking-pulse-dot" aria-hidden="true" />
                            Sẵn sàng gọi
                          </span>
                        )}
                      </div>

                      {/* Main Body: Themed Icon, Title, Goal */}
                      <div className="beego-speaking-card__body">
                        <div
                          className="beego-speaking-card__icon-wrap"
                          style={{
                            background: visual.bg,
                            border: `1.5px solid ${visual.border}`,
                          }}
                          aria-hidden="true"
                        >
                          {visual.icon}
                        </div>
                        <div className="beego-speaking-card__text">
                          <span className="beego-learn-call-tab__topic-title">
                            {displayTitle}
                          </span>
                          <p className="beego-speaking-card__goal">
                            {item.targetGoal || visual.desc}
                          </p>
                        </div>
                      </div>

                      {/* Footer Action */}
                      <div className="beego-speaking-card__footer">
                        {locked ? (
                          <span className="beego-speaking-lock-msg">
                            Hoàn thành bài học ở bản đồ Học để mở khóa
                          </span>
                        ) : (
                          <span className="beego-speaking-cta-btn">
                            🎙️ Luyện nói ngay
                            <span className="beego-speaking-cta-arrow" aria-hidden="true">→</span>
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Motivational Tip Card */}
          <aside className="beego-speaking-tip-card" aria-label="Mẹo luyện nói">
            <span className="beego-speaking-tip-icon" aria-hidden="true">💡</span>
            <div className="beego-speaking-tip-text">
              <strong>Mẹo giao tiếp từ Beego:</strong>
              <p>
                Đừng ngại nói sai! Bạn có thể nói từng câu ngắn, ngập ngừng một chút cũng không sao. Gia sư AI luôn kiên nhẫn lắng nghe, gợi ý từ vựng và hỗ trợ sửa phát âm để bạn tiến bộ nhanh nhất mỗi ngày.
              </p>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="beego-learn-call-layer" role="dialog" aria-label="Gọi gia sư AI">
      <LearnLessonCall
        key={`${selected.sectionId}:${selected.lessonId}`}
        lessonId={selected.lessonId}
        lessonType={selected.lessonType}
        sectionId={selected.sectionId}
        autoCheck
        returnLabel="Chọn chủ đề khác"
        onDismiss={() => setSelected(null)}
      />
    </div>
  );
}
