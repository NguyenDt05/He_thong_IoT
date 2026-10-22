import { useState } from "react";
import { API_BASE_URL } from "../services/apiConfig";
import "./Avatar.css";

const colors = ["#527fa0", "#806ba9", "#378b83", "#ae6b73", "#9b7d42"];

function initialsOf(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return Array.from(parts[0])[0].toLocaleUpperCase("vi-VN");
  return `${Array.from(parts[0])[0]}${Array.from(parts[parts.length - 1])[0]}`.toLocaleUpperCase("vi-VN");
}

export default function Avatar({ user, className = "", decorative = false }) {
  const [failedFile, setFailedFile] = useState(null);
  const file = user?.avatarFile;
  const label = `Ảnh đại diện của ${user?.fullName || "người dùng"}`;
  const classes = `account-avatar ${className}`.trim();

  if (file && failedFile !== file) {
    return (
      <img
        className={classes}
        src={`${API_BASE_URL}/auth/avatar?v=${encodeURIComponent(file)}`}
        alt={decorative ? "" : label}
        onError={() => setFailedFile(file)}
      />
    );
  }

  return (
    <span
      className={`${classes} account-avatar-fallback`}
      style={{ "--avatar-color": colors[(Number(user?.userId) || 0) % colors.length] }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    >
      {initialsOf(user?.fullName)}
    </span>
  );
}
