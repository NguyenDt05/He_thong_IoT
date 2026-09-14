// Hai thao tác chung: gửi form tìm kiếm và xóa toàn bộ giá trị lọc tại trang cha.
function SearchActions({ onClear, clearLabel = "Xóa bộ lọc" }) {
  return (
    <div className="search-actions">
      <button className="search-button" type="submit">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        Tìm kiếm
      </button>
      <button className="clear-button" type="button" onClick={onClear}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 5 19 19M19 5 5 19" />
        </svg>
        {clearLabel}
      </button>
    </div>
  );
}

export default SearchActions;
