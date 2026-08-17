export default function VocabularyPager({ page, totalPages, total = 0, pageSize = 9, onPageChange, onPrev, onNext }) {
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + maxVisible - 1);
  start = Math.max(1, end - maxVisible + 1);

  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <div className="beego-vocab-pager">
      <div className="beego-vocab-pagerNums" role="navigation" aria-label="Phân trang">
        <button type="button" className="beego-vocab-pagerArrow" disabled={page <= 1} onClick={onPrev}>
          ‹
        </button>
        {start > 1 ? <span className="beego-vocab-pagerEllipsis">…</span> : null}
        {pages.map((n) => (
          <button
            key={n}
            type="button"
            className={`beego-vocab-pagerNum ${n === page ? "beego-vocab-pagerNum--active" : ""}`}
            onClick={() => onPageChange(n)}
            aria-current={n === page ? "page" : undefined}
          >
            {n}
          </button>
        ))}
        {end < totalPages ? <span className="beego-vocab-pagerEllipsis">…</span> : null}
        <button
          type="button"
          className="beego-vocab-pagerArrow"
          disabled={page >= totalPages}
          onClick={onNext}
        >
          ›
        </button>
      </div>
      <div className="beego-vocab-pagerMeta">
        {total > 0 ? (
          <>
            <strong>{total.toLocaleString("vi-VN")}</strong> từ · {pageSize}/trang
          </>
        ) : (
          <>
            Hiển thị <strong>{pageSize}</strong> / trang
          </>
        )}
      </div>
    </div>
  );
}
