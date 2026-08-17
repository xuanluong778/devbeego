"use client";

export default function ListeningAnswerChips({ options, selectedIndex, checked, correctIndex, onSelect }) {
  return (
    <div className="ln-answers" role="listbox" aria-label="Chọn đáp án">
      {options.map((opt, index) => {
        let state = "";
        if (checked) {
          if (index === correctIndex) state = "correct";
          else if (index === selectedIndex) state = "wrong";
        } else if (index === selectedIndex) {
          state = "selected";
        }

        return (
          <button
            key={`${opt}-${index}`}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            className={`ln-answer${state ? ` ln-answer--${state}` : ""}`}
            onClick={() => onSelect(index)}
            disabled={checked}
          >
            <span className="ln-answer__letter">{String.fromCharCode(65 + index)}</span>
            <span className="ln-answer__text">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}
