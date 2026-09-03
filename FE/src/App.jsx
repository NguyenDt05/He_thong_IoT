import { Router } from "./router";
import { useNavigation } from "./navigationContext";
import DataSensor from "./pages/DataSensor";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";

// Bảng ánh xạ URL với trang tương ứng; URL không có trong bảng sẽ mở Dashboard.
const pages = {
  "/": Dashboard,
  "/dashboard": Dashboard,
  "/data-sensor": DataSensor,
  "/history": History,
  "/profile": Profile,
};

// Đọc đường dẫn hiện tại từ Router và chọn thành phần trang cần hiển thị.
function AppPages() {
  const { pathname } = useNavigation();
  const Page = pages[pathname] ?? Dashboard;

  return <Page />;
}

// Bọc toàn bộ trang trong Router để các liên kết dùng chung trạng thái điều hướng.
function App() {
  return (
    <Router>
      <AppPages />
    </Router>
  );
}

export default App;
