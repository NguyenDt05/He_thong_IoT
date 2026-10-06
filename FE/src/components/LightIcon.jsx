import "./LightIcon.css";

const rays = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * Math.PI) / 6;
  const x = Math.sin(angle);
  const y = -Math.cos(angle);

  return {
    x1: 32 + x * 21,
    y1: 32 + y * 21,
    x2: 32 + x * 28,
    y2: 32 + y * 28,
  };
});

// Mỗi nhóm ba tia cách nhau 120 độ; nhóm đã bật luôn được giữ khi tăng sáng.
const activationOrder = [0, 4, 8, 2, 6, 10, 1, 5, 9, 3, 7, 11];

export default function LightIcon({ light }) {
  const percent = typeof light === "number" && Number.isFinite(light)
    ? Math.min(100, Math.max(0, light))
    : 0;
  const activeRays = Math.round(percent / 25) * 3;
  const activeRayIndices = new Set(activationOrder.slice(0, activeRays));

  return (
    <svg className="light-sun" viewBox="0 0 64 64" aria-hidden="true">
      {rays.map((ray, index) => (
        <g className={`light-sun-ray${activeRayIndices.has(index) ? " is-active" : ""}`} key={index}>
          <line className="light-sun-glow" {...ray} />
          <line className="light-sun-line" {...ray} />
        </g>
      ))}
      <circle className="light-sun-center" cx="32" cy="32" r="10.5" />
    </svg>
  );
}
