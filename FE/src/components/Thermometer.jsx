import { useId } from "react";
import { Thermometer as LucideThermometer } from "lucide-react";
import "./Thermometer.css";

// Chiều cao hình Lucide trong viewBox 24 x 24, tính cả bầu nhiệt.
const iconTop = 2;
const iconBottom = 22;
const iconViewBoxSize = 24;
const iconSize = 64;

export default function Thermometer({ temperature, scale }) {
  const gradientId = useId();
  const hasTemperature = typeof temperature === "number" && Number.isFinite(temperature);
  const positionPercent = hasTemperature
    ? Math.min(100, Math.max(0, ((temperature - scale.min) / (scale.max - scale.min)) * 100))
    : 0;
  const fillTopPercent = ((iconBottom - (positionPercent / 100) * (iconBottom - iconTop)) / iconViewBoxSize) * 100;

  return (
    <div className="thermometer" aria-hidden="true">
      <LucideThermometer
        className="thermometer-liquid"
        size={iconSize}
        fill={`url(#${gradientId})`}
        stroke="none"
        style={{ clipPath: `inset(${hasTemperature ? fillTopPercent : 100}% 0 0 0)` }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1={iconBottom} x2="0" y2={iconTop} gradientUnits="userSpaceOnUse">
            {scale.colors.map((stop) => (
              <stop key={stop.percent} offset={`${stop.percent}%`} stopColor={stop.color} />
            ))}
          </linearGradient>
        </defs>
      </LucideThermometer>
      <LucideThermometer className="thermometer-outline" size={iconSize} strokeWidth={0.8} color="#64748b" />
    </div>
  );
}
