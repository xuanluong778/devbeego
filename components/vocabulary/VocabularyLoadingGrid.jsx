export default function VocabularyLoadingGrid({ count = 6 }) {
  return (
    <div className="vocab-dash-grid vocab-dash-grid--loading" aria-busy="true" aria-label="Đang tải từ vựng">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="vocab-dash-skeletonCard">
          <div className="vocab-dash-skeletonCard__head">
            <div className="vocab-dash-skeleton vocab-dash-skeleton--word" />
            <div className="vocab-dash-skeleton vocab-dash-skeleton--chip" />
          </div>
          <div className="vocab-dash-skeleton vocab-dash-skeleton--ipa" />
          <div className="vocab-dash-skeleton vocab-dash-skeleton--line" />
          <div className="vocab-dash-skeleton vocab-dash-skeleton--line vocab-dash-skeleton--short" />
          <div className="vocab-dash-skeletonCard__actions">
            <div className="vocab-dash-skeleton vocab-dash-skeleton--btn" />
            <div className="vocab-dash-skeleton vocab-dash-skeleton--btn" />
            <div className="vocab-dash-skeleton vocab-dash-skeleton--btn" />
            <div className="vocab-dash-skeleton vocab-dash-skeleton--btn" />
          </div>
        </div>
      ))}
    </div>
  );
}
