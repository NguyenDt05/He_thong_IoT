import "../styles/SearchBar.css";

// Ô nhập có giá trị do trang cha quản lý; nhấn Enter sẽ gửi form tìm kiếm bao ngoài.
function SearchBar({ value, onChange, placeholder = "Tìm kiếm..." }) {
  return (
    <div className="searchbar">
      <input
        type="text"
        inputMode="search"
        className="search-input"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export default SearchBar;
