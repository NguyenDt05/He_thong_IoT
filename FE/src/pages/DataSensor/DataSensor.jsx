import { useEffect, useRef, useState } from "react";
import { layDuLieuCB_daLuu_sv, layDuLieuCB_sv } from "../../services/dataSensorSV";
import TblDataSensor from "../../components/data/TblDataSensor";
import MainLayout from "../../layouts/MainLayout";
import SearchBar from "../../components/SearchBar";
import SearchActions from "../../components/SearchActions";
import Filter from "../../components/Filter";
import DropdownSelect from "../../components/DropdownSelect";
import Footer from "../../components/Footer";
import "./DataSensor.css";
import "../../styles/Toolbar.css";
import "../../styles/DataTable.css";

// Thiết lập số dòng mỗi trang và thời gian chờ phản hồi API.
const DEFAULT_PAGE_SIZE = 20;
const REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_FILTERS = { key: "", criterion: "all" };
const SEARCH_PLACEHOLDERS = {
  all: "Tìm kiếm...",
  temperature: "Nhập giá trị cảm biến nhiệt độ",
  humidity: "Nhập giá trị cảm biến độ ẩm",
  light: "Nhập giá trị cảm biến ánh sáng",
  datetime: "Nhập ngày giờ (yyyy/MM/dd HH:mm:ss)",
};

// Trang cảm biến quản lý tiêu chí đang nhập, tiêu chí đã áp dụng và dữ liệu nhận từ API.
function DataSensor() {
  // Giá trị trong form chỉ được áp dụng cho bảng sau khi gửi tìm kiếm.
  const [search, setSearch] = useState("");
  const [searchCriterion, setSearchCriterion] = useState("all");
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

  // Tải trang hiện tại và hủy yêu cầu cũ khi đổi trang hoặc bộ lọc đã áp dụng.
  useEffect(() => {
    let active = true;
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

    async function loadData() {
      if (!active) return;
      const controller = new AbortController();
      activeController = controller;
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
        if (activeController === controller) activeController = null;
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
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
    setAppliedFilters({ key: search.trim(), criterion: searchCriterion });
  }

  // Đặt lại cả form và bộ lọc đang áp dụng để tải lại danh sách từ trang đầu.
  function handleClear() {
    setSearch("");
    setSearchCriterion("all");
    setPage(1);
    setAppliedFilters(DEFAULT_FILTERS);
  }

  const showingPreviousRequest = page !== shownPage
    || pageSize !== shownPageSize
    || appliedFilters.key !== shownFilters.key
    || appliedFilters.criterion !== shownFilters.criterion;

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
            <DropdownSelect
              variant="filter"
              ariaLabel="Tiêu chí lọc dữ liệu cảm biến"
              value={searchCriterion}
              onChange={setSearchCriterion}
              options={[
                { value: "all", label: "Tất cả" },
                { value: "temperature", label: "Cảm biến nhiệt độ" },
                { value: "humidity", label: "Cảm biến độ ẩm" },
                { value: "light", label: "Cảm biến ánh sáng" },
                { value: "datetime", label: "Ngày giờ" },
              ]}
            />
          </Filter>
          <div className="sensor-search-input">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder={SEARCH_PLACEHOLDERS[searchCriterion]}
            />
          </div>
          <SearchActions onClear={handleClear} clearLabel="Đặt lại" />
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
