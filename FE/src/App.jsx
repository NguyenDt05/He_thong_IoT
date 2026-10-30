import { Router } from "./router";
import { useNavigation } from "./navigationContext";
import DataSensor from "./pages/DataSensor/DataSensor";
import History from "./pages/History/History";
import Profile from "./pages/Profile/Profile";
import Dashboard from "./pages/Dashboard/Dashboard";
import AuthProvider from "./AuthProvider";
import AuthPage from "./pages/Auth/AuthPage";
import PromoModal from "./components/PromoModal";
import PartyMode from "./components/PartyMode";

// Bảng ánh xạ URL
const pages = {
  "/": Dashboard,
  "/dashboard": Dashboard,
  "/data-sensor": DataSensor,
  "/history": History,
  "/profile": Profile,
  "/login": () => <AuthPage mode="login" />,
  "/register": () => <AuthPage mode="register" />,
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
      <AuthProvider>
        <AppPages />
        <PromoModal />
        <PartyMode />
      </AuthProvider>
    </Router>
  );
}

export default App;
