export default function VocabularyGrid({ items, renderItem, className = "beego-vocab-grid" }) {
  return (
    <div className={className}>
      {items.map((item, index) => renderItem(item, index))}
    </div>
  );
}
