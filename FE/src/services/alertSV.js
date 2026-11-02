import { API_BASE_URL } from "./apiConfig";

export async function layCanhBao_sv(signal) {
  const response = await fetch(`${API_BASE_URL}/hardware/alerts`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Không thể lấy số lần cảnh báo");
  return response.json();
}

export async function luuNguongCanhBao_sv(thresholds) {
  const response = await fetch(`${API_BASE_URL}/hardware/alerts/thresholds`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thresholds }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Không thể lưu ngưỡng cảnh báo");
  return result;
}
