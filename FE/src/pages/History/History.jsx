import { useEffect, useState } from "react";
import MainLayout from "../../layouts/MainLayout";
import { layThietBi_sv } from "../../services/deviceSV";
import { layLichSu_sv } from "../../services/historySV";
import SearchBar from "../../components/SearchBar";
import SearchActions from "../../components/SearchActions";
import Filter from "../../components/Filter";
import DropdownSelect from "../../components/DropdownSelect";
import TblHistory from "../../components/data/TblHistory";
import Footer from "../../components/Footer";
import "./History.css";
import "../../styles/Toolbar.css";

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
  }, [page, pageSize, appliedFilters]);

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
              <DropdownSelect
                variant="filter"
                ariaLabel="Thiết bị"
                value={appliedFilters.device}
                onChange={(value) => handleFilterChange("device", value)}
                options={[
                  { value: "", label: "Tất cả thiết bị" },
                  ...devices.map((item) => ({ value: `DEVICE_${item.deviceId}`, label: item.deviceName })),
                ]}
              />
            </Filter>
            <Filter>
              <DropdownSelect
                variant="filter"
                ariaLabel="Hành động"
                value={appliedFilters.action}
                onChange={(value) => handleFilterChange("action", value)}
                options={[
                  { value: "", label: "Tất cả hành động" },
                  { value: "ON", label: "Bật" },
                  { value: "OFF", label: "Tắt" },
                ]}
              />
            </Filter>
            <Filter>
              <DropdownSelect
                variant="filter"
                ariaLabel="Trạng thái"
                value={appliedFilters.status}
                onChange={(value) => handleFilterChange("status", value)}
                options={[
                  { value: "", label: "Tất cả trạng thái" },
                  { value: "SUCCESS", label: "Success" },
                  { value: "FAILED", label: "Failed" },
                  { value: "PENDING", label: "Pending" },
                ]}
              />
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
