import { API_BASE_URL } from "./apiConfig";

const AUTH_URL = `${API_BASE_URL}/auth`;

async function request(path, options = {}) {
  const response = await fetch(`${AUTH_URL}${path}`, {
    credentials: "include",
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Không thể xử lý tài khoản. Vui lòng thử lại.");
  }
  return response.status === 204 ? null : response.json();
}

export function getCurrentUser(signal) {
  return request("/me", { signal, cache: "no-store" });
}

export function registerUser(data) {
  return request("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function loginUser(data) {
  return request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateCurrentUser(data) {
  return request("/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function uploadUserAvatar(file) {
  return request("/avatar", {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
}

export function logoutUser() {
  return request("/logout", { method: "POST" });
}
