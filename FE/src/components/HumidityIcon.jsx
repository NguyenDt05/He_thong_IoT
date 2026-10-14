
import { useId } from "react";
import "./HumidityIcon.css";

// 1. Cấu hình kích thước vòng tròn và hình giọt nước
const radius = 28;
const circumference = 2 * Math.PI * radius;
const dropTop = 13;
const dropHeight = 36;

// Đường SVG tạo hình dạng giọt nước
const dropPath = "M32 13 C29 18 20 27 20 36 C20 43 25.4 49 32 49 C38.6 49 44 43 44 36 C44 27 35 18 32 13 Z";

// 2. Kiểm tra và giới hạn độ ẩm từ 0 đến 100%
function clampHumidity(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0;
}

export default function HumidityIcon({ humidity }) {
  // 3. Tạo ID riêng cho vùng cắt giọt nước
  const clipId = useId();

  // Chuẩn hóa giá trị độ ẩm
  const humidityValue = clampHumidity(humidity);

  // Tính phần vòng tròn chưa hiển thị
  const progressOffset =
    circumference - (humidityValue / 100) * circumference;

  // Tính khoảng dịch xuống của vùng nước
  const emptyDropHeight =
    dropHeight * (1 - humidityValue / 100);

  return (
    <svg className="humidity-icon" viewBox="0 0 64 64" aria-hidden="true">

      {/* 4. Tạo vùng cắt có hình giọt nước */}
      <defs>
        <clipPath id={clipId}>
          <path d={dropPath} />
        </clipPath>
      </defs>

      {/* 5. Vòng tròn nền và đường theo dõi */}
      <circle className="humidity-icon-background" cx="32" cy="32" r="31" />
      <circle className="humidity-icon-track" cx="32" cy="32" r={radius} />

      {/* 6. Vòng tròn tiến độ theo phần trăm độ ẩm */}
      <circle
        className="humidity-icon-progress"
        cx="32"
        cy="32"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={progressOffset}
      />

      {/* 7. Giọt nước nền */}
      <path className="humidity-icon-drop" d={dropPath} />

      {/* 8. Hình chữ nhật màu nước, bị cắt theo hình giọt */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          className="humidity-icon-water"
          x="20"
          y={dropTop}
          width="24"
          height={dropHeight}
          style={{
            transform: `translateY(${emptyDropHeight}px)`
          }}
        />
      </g>

      {/* 9. Đường viền giọt nước */}
      <path className="humidity-icon-drop-outline" d={dropPath} />
    </svg>
  );
}
