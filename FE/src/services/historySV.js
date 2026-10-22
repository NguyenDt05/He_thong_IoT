import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}/history`;

// Lấy các dòng lịch sử theo trang và bộ lọc để hiển thị trong bảng.
export async function layLichSu_sv(page, limit, filters = {}, signal) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  for (const [name, value] of Object.entries(filters)) {
    if (value) params.set(name, value);
  }

  const response = await fetch(`${API_URL}?${params}`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Không thể tải lịch sử hoạt động");
  return response.json();
}

// Ghi thao tác trên công tắc giao diện vào lịch sử.
export async function ghiLichSu_sv(deviceId, action) {
  const response = await fetch(API_URL, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, action }),
  });
  if (!response.ok) throw new Error("Không thể lưu lịch sử hoạt động");
  return response.json();
}
