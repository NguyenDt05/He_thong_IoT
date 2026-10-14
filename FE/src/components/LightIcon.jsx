
import "./LightIcon.css";

// 1. Tạo 12 tia cách đều nhau 30 độ quanh tâm SVG
const rays = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * Math.PI) / 6;
  const x = Math.sin(angle);
  const y = -Math.cos(angle);

  // Tọa độ điểm đầu và điểm cuối của từng tia
  return {
    x1: 32 + x * 21,
    y1: 32 + y * 21,
    x2: 32 + x * 28,
    y2: 32 + y * 28,
  };
});

// 2. Thứ tự bật tia, chia thành 4 nhóm, mỗi nhóm 3 tia
const activationOrder = [0, 4, 8, 2, 6, 10, 1, 5, 9, 3, 7, 11];

export default function LightIcon({ light }) {
  // 3. Kiểm tra và giới hạn ánh sáng trong khoảng 0–100%
  const percent = typeof light === "number" && Number.isFinite(light)
    ? Math.min(100, Math.max(0, light))
    : 0;

  // 4. Cứ mỗi mức 25%, tăng thêm 3 tia (làm tròn về mức gần nhất)
  const activeRays = Math.round(percent / 25) * 3;

  // 5. Lấy danh sách chỉ số các tia đang sáng
  const activeRayIndices = new Set(
    activationOrder.slice(0, activeRays)
  );

  return (
    <svg className="light-sun" viewBox="0 0 64 64" aria-hidden="true">

      {/* 6. Vẽ 12 tia và gắn class is-active cho tia đang bật */}
      {rays.map((ray, index) => (
        <g
          className={`light-sun-ray${activeRayIndices.has(index) ? " is-active" : ""}`}
          key={index}
        >
          {/* Lớp hiệu ứng sáng mờ */}
          <line className="light-sun-glow" {...ray} />

          {/* Đường nét chính của tia */}
          <line className="light-sun-line" {...ray} />
        </g>
      ))}

      {/* 7. Vẽ hình tròn ở giữa mặt trời */}
      <circle className="light-sun-center" cx="32" cy="32" r="10.5" />
    </svg>
  );
}
