import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { useAuth } from "../authContext";
import { PROMO_CONFIG } from "../config/promo";
import "./PromoModal.css";

function PromoDialog({ onClose }) {
  const closeRef = useRef(null);
  const [index, setIndex] = useState(0);
  const total = PROMO_CONFIG.images.length;
  const image = PROMO_CONFIG.images[index];

  const showSlide = useCallback((next) => {
    setIndex((next + total) % total);
  }, [total]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") showSlide(index - 1);
      if (event.key === "ArrowRight") showSlide(index + 1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, onClose, showSlide]);

  // Tự chuyển ảnh khi cấu hình autoPlayMs > 0; ảnh đơn không cần chạy.
  useEffect(() => {
    if (!PROMO_CONFIG.autoPlayMs || total < 2) return undefined;
    const timer = window.setInterval(() => showSlide(index + 1), PROMO_CONFIG.autoPlayMs);
    return () => window.clearInterval(timer);
  }, [index, showSlide, total]);

  return (
    <div className="promo-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="promo-dialog" role="dialog" aria-modal="true" aria-label="Quảng cáo">
        <button ref={closeRef} className="promo-close" type="button" aria-label="Đóng quảng cáo" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>

        <img key={image.src} className="promo-image" src={image.src} alt={image.alt} />

        {total > 1 && (
          <>
            <button className="promo-nav promo-nav-prev" type="button" aria-label="Ảnh trước"
              onClick={() => showSlide(index - 1)}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button className="promo-nav promo-nav-next" type="button" aria-label="Ảnh sau"
              onClick={() => showSlide(index + 1)}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <div className="promo-dots" role="tablist" aria-label="Chọn ảnh quảng cáo">
              {PROMO_CONFIG.images.map((item, dotIndex) => (
                <button key={item.src} type="button" role="tab"
                  className={`promo-dot${dotIndex === index ? " is-active" : ""}`}
                  aria-selected={dotIndex === index} aria-label={`Ảnh ${dotIndex + 1}`}
                  onClick={() => setIndex(dotIndex)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Hiển thị một lần sau đăng nhập đầu tiên của mỗi tài khoản.
export default function PromoModal() {
  const { user, loading } = useAuth();
  const [openFor, setOpenFor] = useState(null);
  const handledUser = useRef(null);

  const userKey = user?.userId ?? user?.username ?? null;

  useEffect(() => {
    if (loading || !userKey) return undefined;
    if (handledUser.current === userKey) return undefined;
    if (!PROMO_CONFIG.enabled) return undefined;
    if (PROMO_CONFIG.showOnce) {
      try {
        if (window.localStorage.getItem(`${PROMO_CONFIG.storageKey}:${userKey}`)) return undefined;
      } catch {
        // Không đọc được localStorage thì vẫn hiển thị quảng cáo.
      }
    }

    // Chỉ đánh dấu sau khi hộp thực sự mở để StrictMode không chặn lần chạy lại.
    const timer = window.setTimeout(() => {
      handledUser.current = userKey;
      setOpenFor(userKey);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [loading, userKey]);

  const close = useCallback(() => {
    setOpenFor(null);
    if (userKey && PROMO_CONFIG.showOnce) {
      try {
        window.localStorage.setItem(`${PROMO_CONFIG.storageKey}:${userKey}`, new Date().toISOString());
      } catch {
        // Bỏ qua khi trình duyệt chặn lưu trữ.
      }
    }
  }, [userKey]);

  if (!userKey || openFor !== userKey) return null;
  return <PromoDialog onClose={close} />;
}
