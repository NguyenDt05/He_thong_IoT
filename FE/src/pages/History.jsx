import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import { layThietBi_sv } from "../service/deviceSV";
import { layLichSu_sv } from "../service/historySV";
import SearchBar from "../components/SearchBar";
import SearchActions from "../components/SearchActions";
import Filter from "../components/Filter";
import TblHistory from "../components/data/TblHistory";
import Footer from "../components/Footer";
import "../styles/History.css";
import "../styles/Toolbar.css";

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_FILTERS = { key: "", device: "", action: "", status: "" };

// Trang lịch sử gồm thanh tìm kiếm, các bộ lọc, bảng và phân trang.
function History() {
  // Từ khóa chờ gửi form; các hộp lọc áp dụng ngay khi chọn.
  const [search, setSearch] = useState("");
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    function refreshAfterSwitch() {
      setPage(1);
      setRefreshVersion((version) => version + 1);
    }
    window.addEventListener("iot-history-updated", refreshAfterSwitch);
    return () => window.removeEventListener("iot-history-updated", refreshAfterSwitch);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    layThietBi_sv(controller.signal)
      .then(setDevices)
      .catch(() => {
        if (!controller.signal.aborted) setDevices([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadHistory() {
      setLoading(true);
      setError("");
      setRows([]);
      setTotal(0);
      try {
        const result = await layLichSu_sv(page, pageSize, appliedFilters, controller.signal);
        setRows(result.data);
        setTotal(result.total);
      } catch {
        if (controller.signal.aborted) return;
        setRows([]);
        setTotal(0);
        setError("Không thể tải lịch sử hoạt động. Vui lòng thử lại.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadHistory();
    return () => controller.abort();
  }, [page, pageSize, appliedFilters, refreshVersion]);

  function handlePageSizeChange(size) {
    setPage(1);
    setPageSize(size);
  }

  // Đổi một hộp lọc sẽ tải lại trang đầu với từ khóa đã tìm trước đó.
  function handleFilterChange(name, value) {
    setPage(1);
    setAppliedFilters((current) => ({ ...current, [name]: value }));
  }

  // Chỉ từ khóa cần bấm Tìm kiếm hoặc Enter để áp dụng.
  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters((current) => ({ ...current, key: search.trim() }));
  }

  // Trả form và kết quả về trạng thái ban đầu, không giữ lại tiêu chí cũ.
  function handleClear() {
    setSearch("");
    setPage(1);
    setAppliedFilters(DEFAULT_FILTERS);
  }

  // Bố cục trang gồm form nhiều tiêu chí, bảng lịch sử và số lượng bản ghi sau lọc.
  return (
    <MainLayout
      title="Lịch sử hoạt động"
      description="Theo dõi lịch sử hoạt động của thiết bị"
    >
      <div className="history">
        {/* Ô tìm kiếm gửi form; các hộp lọc áp dụng ngay khi thay đổi. */}
        <form className="toolbar history-toolbar" role="search" onSubmit={handleSearch}>
          {/* Ô tìm kiếm theo nội dung hiển thị trong bảng lịch sử. */}
          <div className="toolbar-left">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Tên thiết bị, người dùng, hành động, trạng thái hoặc thời gian"
            />
          </div>
          {/* Ba hộp lọc thiết bị, hành động, trạng thái và các nút thao tác. */}
          <div className="toolbar-right">
            <Filter>
              <select
                className="filter-select"
                aria-label="Thiết bị"
                value={appliedFilters.device}
                onChange={(event) => handleFilterChange("device", event.target.value)}
              >
                <option value="">Tất cả thiết bị</option>
                {devices.map((item) => (
                  <option key={item.deviceId} value={`DEVICE_${item.deviceId}`}>{item.deviceName}</option>
                ))}
              </select>
            </Filter>
            <Filter>
              <select
                className="filter-select"
                aria-label="Hành động"
                value={appliedFilters.action}
                onChange={(event) => handleFilterChange("action", event.target.value)}
              >
                <option value="">Tất cả hành động</option>
                <option value="ON">Bật</option>
                <option value="OFF">Tắt</option>
              </select>
            </Filter>
            <Filter>
              <select
                className="filter-select"
                aria-label="Trạng thái"
                value={appliedFilters.status}
                onChange={(event) => handleFilterChange("status", event.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="PENDING">Pending</option>
              </select>
            </Filter>
            <SearchActions onClear={handleClear} />
          </div>
        </form>

        {/* Bảng và Footer đều nhận dữ liệu sau lọc để số lượng hiển thị khớp kết quả. */}
        <div className="table">
          <TblHistory data={rows} emptyMessage={loading ? "Đang tải dữ liệu..." : error || "Không có dữ liệu phù hợp."} />
        </div>
        <Footer
          page={page}
          limit={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </MainLayout>
  );
}

export default History;
