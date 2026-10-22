import { NavigationLink } from "../router";
import "./Sidebar.css";
import Avatar from "./Avatar";
import { Database, History, LayoutGridCircles, LogOut } from "lucide-react";
import { useAuth } from "../authContext";
import { useNavigation } from "../navigationContext";
import { useState } from "react";

// Thanh điều hướng chính; NavigationLink tự đánh dấu trang đang mở.
function Sidebar() {
  const { user, loading, logout } = useAuth();
  const { navigate } = useNavigation();
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    setLogoutError("");
    try {
      await logout();
      navigate("/");
    } catch {
      setLogoutError("Không thể đăng xuất. Vui lòng thử lại.");
    }
  }

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

      {user ? (
        <div className="sidebar-account">
          <NavigationLink to="/profile" className="sidebar-user">
            <Avatar user={user} className="sidebar-user-avatar" decorative />
            <span className="sidebar-user-name">{user.fullName}</span>
          </NavigationLink>
          <button className="sidebar-logout" type="button" onClick={handleLogout} aria-label="Đăng xuất">
            <LogOut size={20} aria-hidden="true" />
            <span className="sidebar-logout-tooltip" role="tooltip">Đăng xuất</span>
          </button>
        </div>
      ) : (
        <NavigationLink to="/login" className="sidebar-login">
          {loading ? "Đang tải..." : "Đăng nhập"}
        </NavigationLink>
      )}
      {logoutError && <p className="sidebar-logout-error" role="alert">{logoutError}</p>}
    </aside>
  );
}

export default Sidebar;
