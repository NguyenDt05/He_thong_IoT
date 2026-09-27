// Đường dẫn gốc để các service frontend gọi API backend.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
