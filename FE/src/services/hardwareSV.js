import { API_BASE_URL } from "./apiConfig";

export async function layTrangThaiMach_sv(signal) {
  const response = await fetch(`${API_BASE_URL}/hardware/status`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Không thể kiểm tra kết nối mạch");
  const status = await response.json();
  if (typeof status?.connected !== "boolean") throw new Error("Trạng thái mạch không hợp lệ");
  return status;
}
