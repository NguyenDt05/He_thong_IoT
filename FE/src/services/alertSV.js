import { API_BASE_URL } from "./apiConfig";

export async function layCanhBao_sv(signal) {
  const response = await fetch(`${API_BASE_URL}/hardware/alerts`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Không thể lấy số lần cảnh báo");
  return response.json();
}
