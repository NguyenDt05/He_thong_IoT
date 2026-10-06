import "./Filter.css";

// Khung giao diện dùng chung cho các tiêu chí lọc dạng select.
function Filter({ children, className = "" }) {
  return (
    <div className={`filter ${className}`.trim()}>
      {children}
    </div>
  );
}

export default Filter;
