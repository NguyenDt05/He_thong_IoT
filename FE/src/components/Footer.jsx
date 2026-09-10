import "../styles/Footer.css";

const MAX_PAGE = 5; // Số trang tối đa hiển thị
const PAGE_SIZES = [10, 20, 50];

// Tạo tối đa năm nút số trang quanh trang hiện tại.
function getPages(current, total) {
  let start;
  let end;

  if (total <= MAX_PAGE) { // Ít hơn 5 trang -> hiện hết
    start = 1; end = total;
  } else if (current <= 3) { // Gần đầu -> cố định 1 đến 5
    start = 1; end = 5;
  } else if (current >= total - 2) { // Gần cuối -> lấy 5 trang cuối
    start = total - 4; end = total;
  } else {// Ở giữa -> current nằm chính giữa
    start = current - 2; end = current + 2;
  }
  // Mảng số trang được dùng để vẽ các nút bên dưới.
  const pages = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
}


function Footer({ page = 1, limit = 20, pageSize = limit, total = 0, onPageChange, onPageSizeChange }) {
  const totalPage = Math.max(1, Math.ceil(total / limit)); // Tổng số trang
  const current = Math.min(Math.max(page, 1), totalPage); // Trang hiện tại

  const first = total === 0 ? 0 : (current - 1) * limit + 1; // Bản ghi đầu
  const last = Math.min(current * limit, total); // Bản ghi cuối

  const pages = getPages(current, totalPage); // Các trang hiển thị

  const goPage = (page) => { onPageChange?.(page); }; // Chuyển trang

  return (
    <footer className="footer">
      {/* Số dòng bên trái, tổng bản ghi ở giữa. */}
      <label className="page-size-control">
        Số dòng/trang
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
        >
          {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <div className="banghi">
        Hiển thị {first}–{last} / {total} bản ghi
      </div>

      {/* Phân trang */}
      <nav className="phantrang">
        <button
          className="sotrang"
          disabled={current === 1}
          onClick={() => goPage(1)}
        >
          {"<<"}
        </button>
 
        <button
          className="sotrang"
          disabled={current === 1}
          onClick={() => goPage(current - 1)}
        >
          {"<"}
        </button>

        {pages.map((num) => (
          <button
            key={num}
            className={`sotrang ${num === current ? "active" : ""}`} // Thêm lớp "active" nếu là trang hiện tại
            onClick={() => goPage(num)}
          >
            {num}
          </button>
        ))}

        <button
          className="sotrang"
          disabled={current === totalPage}
          onClick={() => goPage(current + 1)}
        >
          {">"}
        </button>

        <button
          className="sotrang"
          disabled={current === totalPage}
          onClick={() => goPage(totalPage)}
        >
          {">>"}
        </button>
      </nav>
    </footer>
  );
}

export default Footer;
