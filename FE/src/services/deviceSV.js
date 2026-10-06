import { API_BASE_URL } from "./apiConfig";

const API_URL = `${API_BASE_URL}/devices`;

// Lấy danh sách thiết bị cho bộ lọc lịch sử và cụm điều khiển trên Dashboard.
export async function layThietBi_sv(signal) {
  const response = await fetch(API_URL, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Không thể tải thiết bị");
  const devices = await response.json();
  if (!Array.isArray(devices)) throw new Error("Dữ liệu thiết bị không hợp lệ");
  return devices;
}
