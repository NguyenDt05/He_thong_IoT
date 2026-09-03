import { useCallback, useEffect, useMemo, useState } from "react";
import { NavigationContext, useNavigation } from "./navigationContext";

// Đồng bộ đường dẫn với lịch sử trình duyệt và cung cấp API điều hướng.
export function Router({ children }) {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  // Theo dõi nút Back/Forward để giao diện cập nhật theo URL của trình duyệt.
  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Chuyển trang bằng History API và cập nhật trạng thái React.
  const navigate = useCallback((to, replace = false) => {
    if (window.location.pathname === to) return;

    if (replace) {
      window.history.replaceState(null, "", to);
    } else {
      window.history.pushState(null, "", to);
    }

    setPathname(to);
  }, []);

  // Giữ giá trị context ổn định khi đường dẫn và hàm điều hướng không đổi.
  const value = useMemo(() => ({ pathname, navigate }), [pathname, navigate]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

// Liên kết nội bộ giữ hành vi mở tab mới/phím bổ trợ của thẻ a thông thường.
export function NavigationLink({ to, children, className = "", ...props }) {
  const { pathname, navigate } = useNavigation();
  const isActive = pathname === to || (to === "/" && pathname === "/dashboard");

  // Chặn tải lại trang khi người dùng nhấp chuột trái vào liên kết nội bộ.
  function handleClick(event) {
    props.onClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (props.target && props.target !== "_self")
    ) {
      return;
    }

    event.preventDefault();
    navigate(to);
  }

  return (
    <a
      {...props}
      href={to}
      className={`${className}${isActive ? " active" : ""}`.trim()}
      aria-current={isActive ? "page" : undefined}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
