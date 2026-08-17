"use client";

export default function AnswerOption({ option, selected, state, onSelect, layout = "default" }) {
  const className = [
    "beego-lesson-option",
    layout === "grid" ? "beego-lesson-option--grid" : "",
    selected ? "beego-lesson-option--selected" : "",
    state === "correct" ? "beego-lesson-option--correct" : "",
    state === "wrong" ? "beego-lesson-option--wrong" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={className} onClick={() => onSelect(option.id)} disabled={!!state}>
      {option.imageEmoji ? (
        <span className="beego-lesson-option__img" aria-hidden>
          {option.imageEmoji}
        </span>
      ) : null}
      <span className="beego-lesson-option__text">{option.text}</span>
    </button>
  );
}
