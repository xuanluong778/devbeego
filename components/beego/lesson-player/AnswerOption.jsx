"use client";

import { useState } from "react";
import { playLessonSfx } from "@/lib/beego/learn/lesson-sfx";

export default function AnswerOption({
  option,
  selected,
  state,
  onSelect,
  layout = "default",
  showVisual = true,
  hideText = false,
  revealMeaning = false,
  ariaLabel,
  buttonRef,
  onKeyDown,
  role,
}) {
  const [imageBroken, setImageBroken] = useState(false);
  const hasPhoto = Boolean(option?.imageUrl);
  const hasEmoji = Boolean(option?.imageEmoji);
  const hasVisual = hasPhoto || hasEmoji;
  // Nếu ẩn text Anh mà không có ảnh/emoji và cũng không hiện nghĩa → hiện text để tránh ô trống.
  const showPrimaryText = !hideText || (!hasVisual && !revealMeaning);
  const className = [
    "beego-lesson-option",
    layout === "grid" ? "beego-lesson-option--grid" : "",
    !showVisual ? "beego-lesson-option--text-only" : "",
    selected ? "beego-lesson-option--selected" : "",
    state === "correct" ? "beego-lesson-option--correct" : "",
    state === "wrong" ? "beego-lesson-option--wrong" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={buttonRef}
      type="button"
      className={className}
      role={role}
      aria-label={ariaLabel}
      aria-checked={role === "radio" ? selected : undefined}
      onKeyDown={onKeyDown}
      onClick={() => {
        if (!state) playLessonSfx("pop");
        onSelect(option.id);
      }}
      disabled={!!state}
    >
      {showVisual && hasPhoto ? (
        imageBroken ? (
          <span className="beego-lesson-option__broken">Ảnh không tải được</span>
        ) : (
          <img
            className="beego-lesson-option__photo"
            src={option.imageUrl}
            alt=""
            onError={() => setImageBroken(true)}
          />
        )
      ) : null}
      {showVisual && !hasPhoto && hasEmoji ? (
        <span className="beego-lesson-option__img" aria-hidden>
          {option.imageEmoji}
        </span>
      ) : null}
      {showPrimaryText ? <span className="beego-lesson-option__text">{option.text}</span> : null}
      {revealMeaning && option.meaningVi ? (
        <span className="beego-lesson-option__meaning">{option.meaningVi}</span>
      ) : null}
    </button>
  );
}
