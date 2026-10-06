import { useId } from "react";
import "./HumidityIcon.css";

const radius = 28;
const circumference = 2 * Math.PI * radius;
const dropTop = 13;
const dropHeight = 36;
const dropPath = "M32 13 C29 18 20 27 20 36 C20 43 25.4 49 32 49 C38.6 49 44 43 44 36 C44 27 35 18 32 13 Z";

function clampHumidity(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0;
}

export default function HumidityIcon({ humidity }) {
  const clipId = useId();
  const humidityValue = clampHumidity(humidity);
  const progressOffset = circumference - (humidityValue / 100) * circumference;
  const emptyDropHeight = dropHeight * (1 - humidityValue / 100);

  return (
    <svg className="humidity-icon" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={dropPath} />
        </clipPath>
      </defs>

      <circle className="humidity-icon-background" cx="32" cy="32" r="31" />
      <circle className="humidity-icon-track" cx="32" cy="32" r={radius} />
      <circle
        className="humidity-icon-progress"
        cx="32"
        cy="32"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={progressOffset}
      />

      <path className="humidity-icon-drop" d={dropPath} />
      <g clipPath={`url(#${clipId})`}>
        <rect
          className="humidity-icon-water"
          x="20"
          y={dropTop}
          width="24"
          height={dropHeight}
          style={{ transform: `translateY(${emptyDropHeight}px)` }}
        />
      </g>
      <path className="humidity-icon-drop-outline" d={dropPath} />
    </svg>
  );
}
