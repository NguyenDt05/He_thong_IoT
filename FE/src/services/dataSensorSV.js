import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}/data-sensor`;
const CACHE_KEY = "iot-last-db-sensor-pages-v2";
const MAX_CACHED_PAGES = 20;

// Nhóm hàm đọc, kiểm tra và lưu trang cảm biến trong bộ nhớ trình duyệt.
function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function cachedPage(key) {
  const saved = readCache()[key];
  return Array.isArray(saved?.data) && Number.isFinite(saved.total) ? saved : null;
}

function savePage(key, result) {
  try {
    const pages = readCache();
    delete pages[key];
    pages[key] = {
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(
      Object.fromEntries(Object.entries(pages).slice(-MAX_CACHED_PAGES)),
    ));
  } catch {
    // Giao diện vẫn hiển thị kết quả API khi trình duyệt không cho lưu bộ nhớ.
  }
}

// Ghép số trang và tiêu chí lọc thành chuỗi truy vấn cho API.
function sensorQuery(page, limit, filters) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.key) params.set("key", filters.key);
  if (filters.criterion && filters.criterion !== "all") params.set("criterion", filters.criterion);
  return params.toString();
}

// Trả lại trang đã lưu khi giao diện cần hiển thị ngay bản gần nhất.
export function layDuLieuCB_daLuu_sv(page, limit, filters = {}) {
  return cachedPage(sensorQuery(page, limit, filters));
}

// Gọi API; khi mất kết nối thì dùng trang đã lưu có cùng số trang và bộ lọc.
export async function layDuLieuCB_sv(page, limit, filters = {}, signal) {
  const query = sensorQuery(page, limit, filters);

  try {
    const response = await fetch(`${API_URL}?${query}`, { signal, cache: "no-store" });
    if (!response.ok) throw new Error("Không thể lấy dữ liệu cảm biến");
    const result = await response.json();
    if (!Array.isArray(result?.data) || !Number.isFinite(result.total)) {
      throw new Error("Dữ liệu cảm biến không hợp lệ");
    }
    savePage(query, result);
    return { ...result, fromCache: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    const saved = cachedPage(query);
    if (saved) return { ...saved, fromCache: true };
    throw error;
  }
}
