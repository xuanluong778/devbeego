"use client";

export default function WordBankAnswer({ question, selected, onChange, state }) {
  const bank = question.wordBank || [];
  const used = new Set(selected);

  const toggleWord = (word) => {
    if (state) return;
    if (used.has(word)) {
      onChange(selected.filter((w) => w !== word));
    } else {
      onChange([...selected, word]);
    }
  };

  const removeAt = (index) => {
    if (state) return;
    onChange(selected.filter((_, i) => i !== index));
  };

  return (
    <div className="beego-lesson-wordbank">
      <div className="beego-lesson-wordbank__sentence">
        {selected.length === 0 ? (
          <span className="beego-lesson-wordbank__placeholder">Chạm các từ bên dưới để ghép câu</span>
        ) : (
          selected.map((word, i) => (
            <button
              key={`${word}-${i}`}
              type="button"
              className="beego-lesson-wordbank__chip beego-lesson-wordbank__chip--placed"
              onClick={() => removeAt(i)}
              disabled={!!state}
            >
              {word}
            </button>
          ))
        )}
      </div>
      <div className="beego-lesson-wordbank__bank">
        {bank.map((word) => (
          <button
            key={word}
            type="button"
            className={`beego-lesson-wordbank__chip${used.has(word) ? " beego-lesson-wordbank__chip--used" : ""}`}
            onClick={() => toggleWord(word)}
            disabled={!!state || used.has(word)}
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}
