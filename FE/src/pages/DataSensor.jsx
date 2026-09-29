import { useEffect, useRef, useState } from "react";
import { layDuLieuCB_daLuu_sv, layDuLieuCB_sv } from "../service/dataSensorSV";
import TblDataSensor from "../components/data/TblDataSensor";
import MainLayout from "../layouts/MainLayout";
import SearchBar from "../components/SearchBar";
import SearchActions from "../components/SearchActions";
import Filter from "../components/Filter";
import Footer from "../components/Footer";
import "../styles/DataSensor.css";
import "../styles/Toolbar.css";

// Thiết lập số dòng mỗi trang và nhịp tải lại của bảng cảm biến.
const DEFAULT_PAGE_SIZE = 20;
const REFRESH_MS = 15_000;
const REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_FILTERS = { key: "", field: "all" };
const SEARCH_PLACEHOLDERS = {
  all: "Tìm theo tên, loại, ngày giờ hoặc giá trị",
  type: "Nhập loại cảm biến (ví dụ: nhiệt độ)",
  datetime: "Nhập ngày giờ (dd/mm/yyyy hh:mm:ss)",
  value: "Nhập giá trị cảm biến",
};

// Trang cảm biến quản lý tiêu chí đang nhập, tiêu chí đã áp dụng và dữ liệu nhận từ API.
function DataSensor() {
  // Giá trị trong form chỉ được áp dụng cho bảng sau khi gửi tìm kiếm.
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);

  // Trạng thái danh sách, phân trang và phản hồi tải dữ liệu.
  const [initialCachedPage] = useState(() => layDuLieuCB_daLuu_sv(1, DEFAULT_PAGE_SIZE, DEFAULT_FILTERS));
  const lastShownRef = useRef(initialCachedPage
    ? { data: initialCachedPage.data, total: initialCachedPage.total, page: 1, pageSize: DEFAULT_PAGE_SIZE, filters: DEFAULT_FILTERS }
    : null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [shownPage, setShownPage] = useState(1);
  const [shownPageSize, setShownPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [shownFilters, setShownFilters] = useState(DEFAULT_FILTERS);
  const [data, setData] = useState(initialCachedPage?.data ?? []);
  const [total, setTotal] = useState(initialCachedPage?.total ?? 0);
  const [hasSnapshot, setHasSnapshot] = useState(Boolean(initialCachedPage));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usingCachedData, setUsingCachedData] = useState(Boolean(initialCachedPage));

  // Cập nhật trang hiện tại định kỳ và hủy yêu cầu cũ khi đổi trang hoặc bộ lọc.
  useEffect(() => {
    let active = true;
    let inFlight = false;
    let activeController = null;

    function showSnapshot(result) {
      lastShownRef.current = { data: result.data, total: result.total, page, pageSize, filters: appliedFilters };
      setData(result.data);
      setTotal(result.total);
      setShownPage(page);
      setShownPageSize(pageSize);
      setShownFilters(appliedFilters);
      setHasSnapshot(true);
    }

    async function loadData(silent = false) {
      if (!active || inFlight) return;
      inFlight = true;
      const controller = new AbortController();
      activeController = controller;
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      if (!silent) {
        const saved = layDuLieuCB_daLuu_sv(page, pageSize, appliedFilters);
        setLoading(true);
        setError("");
        if (saved) {
          showSnapshot(saved);
          setUsingCachedData(true);
        } else if (!lastShownRef.current) {
          setData([]);
          setTotal(0);
          setUsingCachedData(false);
        }
      }

      try {
        const result = await layDuLieuCB_sv(page, pageSize, appliedFilters, controller.signal);
        if (!active || controller.signal.aborted) return;
        showSnapshot(result);
        setUsingCachedData(result.fromCache);
        setError("");
      } catch {
        if (!active) return;
        const last = lastShownRef.current;
        if (last) {
          setData(last.data);
          setTotal(last.total);
          setShownPage(last.page);
          setShownPageSize(last.pageSize);
          setShownFilters(last.filters);
          setUsingCachedData(true);
        } else {
          setData([]);
          setTotal(0);
          setUsingCachedData(false);
          setError("Không thể tải dữ liệu cảm biến. Vui lòng thử lại.");
        }
      } finally {
        window.clearTimeout(timeout);
        inFlight = false;
        if (activeController === controller) activeController = null;
        if (active && !silent) setLoading(false);
      }
    }

    loadData();
    const interval = window.setInterval(() => loadData(true), REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
      activeController?.abort();
    };
  }, [page, pageSize, appliedFilters]);

  function handlePageSizeChange(size) {
    setPage(1);
    setPageSize(size);
  }

  // Chỉ áp dụng từ khóa và tiêu chí đã chọn khi gửi form.
  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters({ key: search.trim(), field: searchField });
  }

  // Xóa ô nhập, tiêu chí chọn và danh sách đã lọc bằng cách tải lại trang đầu.
  function handleClear() {
    setSearch("");
    setSearchField("all");
    setPage(1);
    setAppliedFilters(DEFAULT_FILTERS);
  }

  const showingPreviousRequest = page !== shownPage
    || pageSize !== shownPageSize
    || appliedFilters.key !== shownFilters.key
    || appliedFilters.field !== shownFilters.field;

  // Bố cục trang gồm form tìm kiếm, bảng kết quả và chân bảng phân trang.
  return (
    <MainLayout
      title="Dữ liệu cảm biến"
      description="Theo dõi dữ liệu được gửi từ các cảm biến trong hệ thống"
    >
      <div className="data-sensor">
        {/* Chọn tiêu chí và nhập từ khóa trước; bảng chỉ đổi khi gửi form. */}
        <form className="toolbar sensor-toolbar" role="search" onSubmit={handleSearch}>
          <Filter>
            <select
              className="filter-select"
              aria-label="Tiêu chí lọc dữ liệu cảm biến"
              value={searchField}
              onChange={(event) => setSearchField(event.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="type">Loại cảm biến</option>
              <option value="datetime">Ngày giờ</option>
              <option value="value">Giá trị</option>
            </select>
          </Filter>
          <div className="sensor-search-input">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder={SEARCH_PLACEHOLDERS[searchField]}
            />
          </div>
          <SearchActions onClear={handleClear} clearLabel="Loại bỏ lọc" />
        </form>

        {/* Dòng thông báo nằm trên bảng khi đang hiển thị bản đã lưu. */}
        {(usingCachedData || (loading && showingPreviousRequest && hasSnapshot)) && (
          <p className="sensor-cache-notice" role="status">
            {showingPreviousRequest
              ? loading
                ? "Đang tải trang hoặc bộ lọc mới; bảng vẫn hiển thị kết quả trước đó."
                : "Không thể tải trang hoặc bộ lọc mới. Bảng vẫn hiển thị kết quả trước đó."
              : loading
                ? "Đang hiển thị dữ liệu đã lưu trong khi cập nhật từ cơ sở dữ liệu."
                : "Mất kết nối. Đang hiển thị dữ liệu cảm biến đã tải gần nhất."}
          </p>
        )}

        {/* Vùng bảng hiển thị dữ liệu hoặc trạng thái tải/lỗi/không có kết quả. */}
        <div className="table">
          <TblDataSensor
            data={data}
            emptyMessage={loading ? "Đang tải dữ liệu..." : error || "Không có dữ liệu phù hợp."}
          />
        </div>
        {/* Footer hiển thị tổng số bản ghi và điều hướng trang từ kết quả API. */}
        <Footer
          page={shownPage}
          limit={shownPageSize}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </MainLayout>
  );
}

export default DataSensor;
