import { NavigationLink } from "../router";
import "../styles/Sidebar.css";

// Thanh điều hướng chính; NavigationLink tự đánh dấu trang đang mở.
function Sidebar() {
  return (
    <aside className="sidebar">
      <NavigationLink to="/" className="sidebar-logo">
        IoT System
      </NavigationLink>

      {/* Nhóm liên kết dẫn tới các màn hình của hệ thống. */}
      <nav className="sidebar-menu" aria-label="Điều hướng chính">
        <NavigationLink to="/" className="sidebar-item">
          Trang chủ
        </NavigationLink>
        <NavigationLink to="/data-sensor" className="sidebar-item">
          Dữ liệu cảm biến
        </NavigationLink>
        <NavigationLink to="/history" className="sidebar-item">
          Lịch sử hoạt động
        </NavigationLink>
        <NavigationLink to="/profile" className="sidebar-item">
          Hồ sơ cá nhân
        </NavigationLink>
      </nav>
    </aside>
  );
}

export default Sidebar;
