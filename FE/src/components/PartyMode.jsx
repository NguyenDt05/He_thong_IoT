import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { PARTY_CONFIG } from "../config/partyMode";
import "./PartyMode.css";

// Các khối sẽ bay loạn; mỗi phần tử nhận thông số ngẫu nhiên riêng.
const PARTY_TARGETS = [
  ".sidebar", ".sidebar-item", ".page-header",
  ".dashboard-card", ".light-card", ".device-panel", ".chart-card", ".threshold-card",
  ".table", ".footer", ".filter", ".searchbar", ".search-actions button",
  ".profile-frame", ".profile-info", ".profile-links", ".profile-link",
  ".profile-info-item", ".profile-section-heading", ".auth-panel",
  ".dashboard-sensor-header",
].join(", ");

const PARTY_VARS = [
  "--cx1", "--cy1", "--cr1", "--cs1", "--cx2", "--cy2", "--cr2", "--cs2",
  "--cx3", "--cy3", "--cr3", "--cs3", "--party-duration", "--party-delay",
  "--party-text-delay", "--party-text-duration",
];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function soNgauNhien(min, max) {
  return Math.round(randomBetween(min, max) * PARTY_CONFIG.chaos);
}

// encodeURI không mã hóa dấu # nên phải thay thủ công để tên file hợp lệ.
function assetUrl(path) {
  return encodeURI(path).replaceAll("#", "%23");
}

// Sinh các nhân vật bay vào từ bốn phía trên đường cong mượt.
function taoNhanVat() {
  const edges = ["left", "right", "top", "bottom"];
  const total = PARTY_CONFIG.characterCount ?? PARTY_CONFIG.characters.length;
  const width = window.innerWidth;
  const height = window.innerHeight;

  return Array.from({ length: total }, (_, index) => {
    const edge = edges[index % edges.length];
    const cross = randomBetween(8, 88) / 100;
    const reverse = randomBetween(5, 92) / 100;
    let startX;
    let startY;
    let endX;
    let endY;

    if (edge === "left") {
      startX = -0.15 * width; startY = cross * height;
      endX = 1.15 * width; endY = reverse * height;
    } else if (edge === "right") {
      startX = 1.15 * width; startY = cross * height;
      endX = -0.15 * width; endY = reverse * height;
    } else if (edge === "top") {
      startX = cross * width; startY = -0.18 * height;
      endX = reverse * width; endY = 1.18 * height;
    } else {
      startX = cross * width; startY = 1.18 * height;
      endX = reverse * width; endY = -0.18 * height;
    }

    // Hai điểm điều khiển tạo đường bay cong, không gấp khúc.
    const control1X = randomBetween(0.05, 0.95) * width;
    const control1Y = randomBetween(0.05, 0.95) * height;
    const control2X = randomBetween(0.05, 0.95) * width;
    const control2Y = randomBetween(0.05, 0.95) * height;

    const size = randomBetween(64, 122);

    return {
      id: `char-${Date.now()}-${index}`,
      src: assetUrl(PARTY_CONFIG.characters[index % PARTY_CONFIG.characters.length]),
      size,
      duration: randomBetween(7, 13),
      delay: randomBetween(0, 4),
      path: `path("M ${startX.toFixed(0)} ${startY.toFixed(0)} C ${control1X.toFixed(0)} ${control1Y.toFixed(0)}, ${control2X.toFixed(0)} ${control2Y.toFixed(0)}, ${endX.toFixed(0)} ${endY.toFixed(0)}")`,
      // Các icon lửa cầu vồng bám theo quỹ đạo, trễ dần về phía sau nhân vật.
      flames: Array.from({ length: 5 }, (_, flameIndex) => ({
        hue: Math.round(randomBetween(0, 360)),
        lag: 0.12 + flameIndex * 0.16,
        size: Math.max(20, Math.round(size * (1 - flameIndex * 0.14))),
      })),
    };
  });
}

// Nút ẩn ở góc dưới bên phải: mèo rơi vào giữa trước, sau đó đèn disco và hỗn loạn.
export default function PartyMode() {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [characters, setCharacters] = useState([]);
  const chaosOn = active && phase === "disco";

  useEffect(() => {
    document.documentElement.classList.toggle("party-mode", chaosOn);
    return () => document.documentElement.classList.remove("party-mode");
  }, [chaosOn]);

  // Sau khi mèo rơi xuống giữa màn hình, hẹn giờ bật đèn disco và hỗn loạn.
  useEffect(() => {
    if (phase !== "cats") return undefined;
    const timer = window.setTimeout(
      () => setPhase("disco"),
      PARTY_CONFIG.discoDelayMs ?? 3000,
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!active) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") {
        setActive(false);
        setPhase("idle");
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active]);

  // Gắn thông số chuyển động ngẫu nhiên cho từng khối giao diện.
  useEffect(() => {
    if (!chaosOn) return undefined;
    const elements = Array.from(document.querySelectorAll(PARTY_TARGETS));
    elements.forEach((element) => {
      element.classList.add("party-chaos");
      const set = (name, value) => element.style.setProperty(name, value);
      set("--cx1", `${soNgauNhien(-90, 90)}px`);
      set("--cy1", `${soNgauNhien(-70, 70)}px`);
      set("--cr1", `${soNgauNhien(-22, 22)}deg`);
      set("--cs1", randomBetween(0.85, 1.12).toFixed(2));
      set("--cx2", `${soNgauNhien(-90, 90)}px`);
      set("--cy2", `${soNgauNhien(-70, 70)}px`);
      set("--cr2", `${soNgauNhien(-22, 22)}deg`);
      set("--cs2", randomBetween(0.85, 1.12).toFixed(2));
      set("--cx3", `${soNgauNhien(-90, 90)}px`);
      set("--cy3", `${soNgauNhien(-70, 70)}px`);
      set("--cr3", `${soNgauNhien(-22, 22)}deg`);
      set("--cs3", randomBetween(0.85, 1.12).toFixed(2));
      set("--party-duration", `${randomBetween(0.45, 1.3).toFixed(2)}s`);
      set("--party-delay", `${randomBetween(0, 0.5).toFixed(2)}s`);
      set("--party-text-delay", `${randomBetween(0, 0.8).toFixed(2)}s`);
      set("--party-text-duration", `${randomBetween(0.35, 0.75).toFixed(2)}s`);
    });

    return () => {
      elements.forEach((element) => {
        element.classList.remove("party-chaos");
        PARTY_VARS.forEach((name) => element.style.removeProperty(name));
      });
    };
  }, [chaosOn]);

  if (!PARTY_CONFIG.enabled) return null;

  function toggle() {
    if (active) {
      setActive(false);
      setPhase("idle");
      return;
    }
    setPhase("cats");
    setCharacters(taoNhanVat());
    setActive(true);
  }

  return (
    <>
      <button
        className="party-trigger"
        type="button"
        aria-label={active ? "Tắt hiệu ứng đặc biệt" : "Bật hiệu ứng đặc biệt"}
        aria-pressed={active}
        onClick={toggle}
        title=""
      />

      {active && (
        <div className="party-layer" aria-hidden="true">
          {phase === "disco" && (
            <>
              <div className="party-disco" />
              <div className="party-rainbow" />
              {["tl", "tr", "bl", "br"].map((corner) => (
                <video key={corner}
                  className={`party-bear party-bear-${corner}`}
                  src={assetUrl(PARTY_CONFIG.bearVideo)}
                  autoPlay muted loop playsInline />
              ))}
              {characters.map((character) => (
                <div className="party-character" key={character.id}
                  style={{
                    "--size": `${character.size}px`,
                    "--duration": `${character.duration}s`,
                    "--delay": `${character.delay}s`,
                    "--path": character.path,
                  }}>
                  {character.flames.map((flame, flameIndex) => (
                    <span className="party-flame" key={flameIndex}
                      style={{
                        "--flame-hue": flame.hue,
                        "--flame-lag": `${flame.lag}s`,
                        "--flame-w": `${flame.size}px`,
                      }}>
                      <Flame className="party-flame-inner" aria-hidden="true" />
                      <Flame className="party-flame-outer" aria-hidden="true" />
                    </span>
                  ))}
                  <img className="party-character-sprite" src={character.src} alt="" />
                </div>
              ))}
            </>
          )}

          <div className="party-center-cat"
            style={{ "--spin-delay": `${PARTY_CONFIG.discoDelayMs ?? 3000}ms` }}>
            <video className="party-cat-video" src={assetUrl(PARTY_CONFIG.catVideo)}
              autoPlay muted loop playsInline />
          </div>
        </div>
      )}
    </>
  );
}
