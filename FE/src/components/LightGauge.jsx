import { useId } from "react";
import { formatSensorValue } from "../utils/formatSensorValue";

// Sample the rounded arch so both the marker and ticks follow its actual length.
const curves = [
  [[43, 142], [37, 130], [36, 112], [36, 94]],
  [[36, 94], [36, 57], [54, 36], [85, 36]],
  [[85, 36], [95, 36], [105, 36], [115, 36]],
  [[115, 36], [146, 36], [164, 57], [164, 94]],
  [[164, 94], [164, 112], [163, 130], [157, 142]],
];
const samples = curves.flatMap((curve, index) => Array.from({ length: 41 }, (_, step) => {
  const t = step / 40;
  const coordinate = (axis) => (1 - t) ** 3 * curve[0][axis]
    + 3 * (1 - t) ** 2 * t * curve[1][axis]
    + 3 * (1 - t) * t ** 2 * curve[2][axis] + t ** 3 * curve[3][axis];
  return { x: coordinate(0), y: coordinate(1), length: 0 };
}).slice(index === 0 ? 0 : 1));
for (let index = 1; index < samples.length; index++) {
  samples[index].length = samples[index - 1].length
    + Math.hypot(samples[index].x - samples[index - 1].x, samples[index].y - samples[index - 1].y);
}

function point(percent) {
  const length = samples.at(-1).length * (percent / 100);
  const index = Math.max(1, samples.findIndex((sample) => sample.length >= length));
  const before = samples[index - 1];
  const after = samples[index];
  const fraction = (length - before.length) / (after.length - before.length);
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const distance = Math.hypot(dx, dy);
  return {
    x: before.x + dx * fraction,
    y: before.y + dy * fraction,
    nx: dy / distance,
    ny: -dx / distance,
  };
}

const warmArc = "M 43 142 C 37 130 36 112 36 94 C 36 57 54 36 85 36 L 100 36";
const coolArc = "M 100 36 L 115 36 C 146 36 164 57 164 94 C 164 112 163 130 157 142";

export default function LightGauge({ value }) {
  const id = useId();
  const hasValue = typeof value === "number" && Number.isFinite(value);
  const percent = hasValue ? Math.max(0, Math.min(100, value)) : 0;
  const marker = point(percent);

  return (
    <div className="env-light-gauge" role="img" aria-label={hasValue ? `Ánh sáng ${formatSensorValue(value)} phần trăm` : "Ánh sáng chưa có dữ liệu"}>
      <svg viewBox="0 0 200 180" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-warm`} x1="36" y1="142" x2="86" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff3f79" />
            <stop offset="24%" stopColor="#ff3f79" />
            <stop offset="55%" stopColor="#ff9500" />
            <stop offset="100%" stopColor="#ffe1a3" />
          </linearGradient>
          <linearGradient id={`${id}-cool`} x1="110" y1="36" x2="164" y2="142" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffe1a3" />
            <stop offset="35%" stopColor="#c9b5ff" />
            <stop offset="75%" stopColor="#9965ff" />
            <stop offset="100%" stopColor="#6e35ff" />
          </linearGradient>
          <radialGradient id={`${id}-glow`}>
            <stop offset="0%" stopColor="#d9c9ff" stopOpacity=".55" />
            <stop offset="100%" stopColor="#f9f7ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="156" rx="66" ry="15" fill={`url(#${id}-glow)`} />
        <path d={`${warmArc} ${coolArc.replace("M 100 36", "L 100 36")} Q 100 168 43 142 Z`} fill="white" />
        {Array.from({ length: 19 }, (_, index) => {
          const tick = point(index * 100 / 18);
          const outerOffset = index % 3 === 0 ? 17 : 15;
          return <line key={index} x1={tick.x + tick.nx * 11} y1={tick.y + tick.ny * 11}
            x2={tick.x + tick.nx * outerOffset} y2={tick.y + tick.ny * outerOffset}
            stroke="#eeebf5" strokeWidth="1.2" strokeLinecap="round" />;
        })}
        <path d={warmArc} fill="none" stroke={`url(#${id}-warm)`} strokeWidth="5.5" strokeLinecap="round" />
        <path d={coolArc} fill="none" stroke={`url(#${id}-cool)`} strokeWidth="5.5" strokeLinecap="round" />
        {hasValue && <circle className="env-gauge-marker" cx={marker.x} cy={marker.y} r="8" fill="white" stroke="#d3bcf0" strokeWidth="1.5" />}
        <text className="env-gauge-value" x="100" y="107" textAnchor="middle" dominantBaseline="middle">
          {formatSensorValue(hasValue ? value : undefined)}<tspan className="env-gauge-unit">%</tspan>
        </text>
        <text className="env-gauge-limit" x="24" y="157" textAnchor="middle">0</text>
        <text className="env-gauge-limit" x="176" y="157" textAnchor="middle">100</text>
      </svg>
    </div>
  );
}
