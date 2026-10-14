
import { useId } from "react";
import { Thermometer as LucideThermometer } from "lucide-react";
import "./Thermometer.css";

// Các mốc tọa độ để tính chiều cao mức nhiệt
const iconTop = 2;
const iconBottom = 22;
const iconViewBoxSize = 24;
const iconSize = 64;

export default function Thermometer({ temperature, scale }) {
  // 1. Tạo ID gradient riêng và kiểm tra nhiệt độ hợp lệ
  const gradientId = useId();
  const hasTemperature =
    typeof temperature === "number" && Number.isFinite(temperature);

  // 2. Quy đổi nhiệt độ về tỷ lệ 0–100%
  const positionPercent = hasTemperature
    ? Math.min(100, Math.max(0,
        ((temperature - scale.min) / (scale.max - scale.min)) * 100
      ))
    : 0;

  // 3. Tính phần cần che để biểu diễn mức nhiệt
  const fillTopPercent =
    ((iconBottom - (positionPercent / 100) *
      (iconBottom - iconTop)) / iconViewBoxSize) * 100;

  return (
    <div className="thermometer" aria-hidden="true">
      {/* 4. Lớp màu: mức chất lỏng thay đổi theo nhiệt độ */}
      <LucideThermometer
        className="thermometer-liquid"
        size={iconSize}
        fill={`url(#${gradientId})`} // Sử dụng gradient để tạo dải màu
        stroke="none"                // Không vẽ viền cho lớp màu
        style={{
          clipPath: `inset(${hasTemperature ? fillTopPercent : 100}% 0 0 0)`
        }}
      >
        {/* Tạo dải màu gradient từ cấu hình Dashboard */}
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1={iconBottom}
            x2="0"
            y2={iconTop}
            gradientUnits="userSpaceOnUse"
          >
            {scale.colors.map((stop) => (
              <stop
                key={stop.percent}
                offset={`${stop.percent}%`}
                stopColor={stop.color}
              />
            ))}
          </linearGradient>
        </defs>
      </LucideThermometer>

      {/* 5. Lớp viền cố định phủ lên lớp màu */}
      <LucideThermometer
        className="thermometer-outline"
        size={iconSize}
        strokeWidth={0.8}
        color="#64748b"
      />
    </div>
  );
}
