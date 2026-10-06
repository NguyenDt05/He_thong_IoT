import { NavigationLink } from "../router";
import "./Sidebar.css";
import avt from "../assets/avt.jpg";
import { Database, History, LayoutGridCircles } from "lucide-react";

// Thanh điều hướng chính; NavigationLink tự đánh dấu trang đang mở.
function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        IoT System
      </div>

      {/* Nhóm liên kết dẫn tới các màn hình của hệ thống. */}
      <nav className="sidebar-menu" aria-label="Điều hướng chính">
        <NavigationLink to="/" className="sidebar-item">
          <LayoutGridCircles size={22} aria-hidden="true" />
          <span>Trang chủ</span>
        </NavigationLink>
        <NavigationLink to="/data-sensor" className="sidebar-item">
          <Database size={22} aria-hidden="true" />
          <span>Dữ liệu cảm biến</span>
        </NavigationLink>
        <NavigationLink to="/history" className="sidebar-item">
          <History size={22} aria-hidden="true" />
          <span>Lịch sử hoạt động</span>
        </NavigationLink>
      </nav>

      <NavigationLink to="/profile" className="sidebar-user" >
        <img className="sidebar-user-avatar" src={avt} alt="" />
        <span className="sidebar-user-name">Đặng Thảo Nguyên</span>
      </NavigationLink>
    </aside>
  );
}

export default Sidebar;
